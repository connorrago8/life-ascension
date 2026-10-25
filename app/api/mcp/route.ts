import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  authenticateRequest,
  authenticationErrorResponse,
  hasScope,
  type AuthSuccess,
} from '../../../lib/apiKeyAuth';
import { readBearerToken } from '../../../lib/apiKey';
import { mcpDomains, runMcpTool } from '../../../lib/mcpTools';
import { calendarDate, questDay } from '../../../lib/questDay';
import { createServiceRoleClient } from '../../../lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const tools = [
  {
    name: 'create_quest',
    description: 'Schedule a quest for a planned action. Does not mark it completed and does not award XP. quest_type "goal" is a one-time deadline that can be completed early. A one-time chore cannot be completed before its due date. A daily habit earns XP only for the America/Chicago calendar date and the previous 2 days, measured from midnight by the server. If its start is older than that, the first instance opens on that calendar date minus 2 days. When due_date is omitted, a daily habit uses the 5:00 AM America/Chicago quest day, and a one-time quest or goal uses the America/Chicago calendar date.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        domain: { type: 'string', enum: mcpDomains },
        cadence: { type: 'string', enum: ['once', 'daily'] },
        due_date: { type: 'string', description: 'Optional YYYY-MM-DD. Omitted daily quests use the 5:00 AM America/Chicago quest day. Omitted one-time quests and goals use the America/Chicago calendar date. The server accepts 30 days ago through 366 days ahead, measured from midnight America/Chicago. A daily start older than 2 server days still saves that start, and the opened instance is dated server today minus 2 days.' },
        quest_type: { type: 'string', enum: ['scheduled', 'goal'], description: 'Default scheduled. goal requires cadence once.' },
      },
      required: ['title', 'domain', 'cadence'],
    },
  },
  {
    name: 'update_progress',
    description: 'Save a progress note. This does not award XP and does not complete the quest.',
    inputSchema: {
      type: 'object',
      properties: {
        quest_id: { type: 'string' },
        note: { type: 'string' },
        percent: { type: 'integer', minimum: 0, maximum: 100 },
        instance_id: { type: 'string' },
        source: { type: 'string', enum: ['web', 'chatgpt', 'grok', 'api'] },
      },
      required: ['quest_id', 'note'],
    },
  },
  {
    name: 'submit_completion',
    description: 'Record completion only when confirmed_complete is explicitly true. The server calls set_quest_instance_status, which awards XP at most once per instance. A daily habit earns XP only when its instance date is the America/Chicago calendar date or one of the previous 2 days. Older days and future days are rejected. Between midnight and 5:00 AM America/Chicago, an omitted daily due_date is the previous quest day, which that window accepts. Overdue one-time chores can still be completed. Deadline goals can be completed early.',
    inputSchema: {
      type: 'object',
      properties: {
        quest_id: { type: 'string' },
        due_date: { type: 'string', description: 'Optional YYYY-MM-DD. Defaults to the 5:00 AM America/Chicago quest day for daily quests, or the scheduled date for one-time quests. An explicit date is sent unchanged.' },
        confirmed_complete: { type: 'boolean', description: 'Must be true. Do not set this for partial, negated, planned, or ambiguous actions.' },
      },
      required: ['quest_id', 'confirmed_complete'],
    },
  },
  {
    name: 'list_quests',
    description: 'Read the current user\'s active quests and the instances that belong to those quests. Inactive quests and their instances are omitted.',
    inputSchema: {
      type: 'object',
      properties: {
        due_date: { type: 'string', description: 'Optional YYYY-MM-DD. When omitted, daily instances use the 5:00 AM America/Chicago quest day and one-time instances use the America/Chicago calendar date. Pass a date to filter every cadence to that exact date.' },
        include_history: { type: 'boolean', description: 'Set true to include historical instances of active quests' },
      },
    },
  },
  {
    name: 'get_character_progress',
    description: 'Read lifetime XP and the caller\'s completed instance count. This returns numbers only, not quest or instance rows. Lifetime XP includes every award for that user.',
    inputSchema: { type: 'object', properties: {} },
  },
];

type Actor = { auth: AuthSuccess; db: SupabaseClient };

const fail = (id: unknown, code: number, message: string) => NextResponse.json({ jsonrpc: '2.0', id, error: { code, message } });

export async function GET() {
  return authenticationErrorResponse({ ok: false, status: 401, error: 'Bearer token required' });
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) return authenticationErrorResponse(auth);
  const opened = openActor(auth, readBearerToken(req.headers.get('authorization')) ?? '');
  if ('ok' in opened) return authenticationErrorResponse(opened);
  const actor: Actor = { auth, db: opened.db };

  let body: { jsonrpc?: string; id?: unknown; method?: string; params?: { name?: string; arguments?: Record<string, unknown> } };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const id = body.id ?? null;
  if (body.method === 'initialize') {
    return NextResponse.json({ jsonrpc: '2.0', id, result: { protocolVersion: '2025-03-26', capabilities: { tools: {} }, serverInfo: { name: 'life-ascension', version: '0.1.0' } } });
  }
  if (body.method === 'notifications/initialized') return new Response(null, { status: 202 });
  if (body.method === 'tools/list') return NextResponse.json({ jsonrpc: '2.0', id, result: { tools } });
  if (body.method !== 'tools/call') return fail(id, -32601, 'Method not found');

  const name = body.params?.name ?? '';
  const args = body.params?.arguments ?? {};
  if (name === 'create_quest' || name === 'update_progress' || name === 'submit_completion') {
    if (!hasScope(auth, 'quests:write')) return NextResponse.json({ error: 'Missing quests:write scope' }, { status: 403 });
  } else if (name === 'list_quests' || name === 'get_character_progress') {
    if (!hasScope(auth, 'quests:read')) return NextResponse.json({ error: 'Missing quests:read scope' }, { status: 403 });
  }

  const now = new Date();
  const outcome = await runMcpTool({
    db: actor.db,
    userId: auth.userId,
    method: auth.method,
    name,
    args,
    today: calendarDate(now),
    questDay: questDay(now),
  });
  if (!outcome.ok) return fail(id, outcome.rpcCode, outcome.message);
  return NextResponse.json({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(outcome.result) }] } });
}

function openActor(auth: AuthSuccess, token: string): { db: SupabaseClient } | { ok: false; status: 503; error: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return { ok: false, status: 503, error: 'Server not configured' };
  if (auth.method === 'supabase_jwt') {
    return {
      db: createClient(url, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      }),
    };
  }
  const admin = createServiceRoleClient();
  if (!admin) return { ok: false, status: 503, error: 'API key authentication is not configured' };
  return { db: admin };
}
