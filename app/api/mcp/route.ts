import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  authenticateRequest,
  authenticationErrorResponse,
  hasScope,
  type AuthSuccess,
} from '../../../lib/apiKeyAuth';
import { readBearerToken } from '../../../lib/apiKey';
import { createServiceRoleClient } from '../../../lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const domains = ['hygiene', 'home', 'mental_health', 'personal_growth', 'finance', 'career', 'relationships', 'physical_health'];
const sources = ['web', 'chatgpt', 'grok', 'api'];

const tools = [
  {
    name: 'create_quest',
    description: 'Schedule a quest for a planned action. Does not mark it completed and does not award XP. quest_type "goal" is a one-time deadline that can be completed early. "scheduled" chores and daily habits cannot be completed before their due date.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        domain: { type: 'string', enum: domains },
        cadence: { type: 'string', enum: ['once', 'daily'] },
        due_date: { type: 'string', description: 'Optional Chicago calendar date YYYY-MM-DD. Defaults to today. The server accepts 30 days ago through 366 days ahead.' },
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
        source: { type: 'string', enum: sources },
      },
      required: ['quest_id', 'note'],
    },
  },
  {
    name: 'submit_completion',
    description: 'Record completion only when confirmed_complete is explicitly true. The server calls set_quest_instance_status, which awards XP at most once. Future daily habits and future scheduled chores are rejected. Deadline goals can be completed early.',
    inputSchema: {
      type: 'object',
      properties: {
        quest_id: { type: 'string' },
        due_date: { type: 'string', description: 'Optional YYYY-MM-DD. Defaults to today for daily quests, or the scheduled date for one-time quests.' },
        confirmed_complete: { type: 'boolean', description: 'Must be true. Do not set this for partial, negated, planned, or ambiguous actions.' },
      },
      required: ['quest_id', 'confirmed_complete'],
    },
  },
  {
    name: 'list_quests',
    description: 'Read the current user\'s active quests and instances. Inactive quests are omitted.',
    inputSchema: {
      type: 'object',
      properties: {
        due_date: { type: 'string', description: 'Optional ISO date; defaults to today' },
        include_history: { type: 'boolean', description: 'Set true to include historical instances' },
      },
    },
  },
  {
    name: 'get_character_progress',
    description: 'Read lifetime XP and completed quest count.',
    inputSchema: { type: 'object', properties: {} },
  },
];

type RpcResult = { data: unknown; error: { message: string } | null };
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

  const name = body.params?.name;
  const args = body.params?.arguments ?? {};
  const bad = (message: string) => fail(id, -32602, message);
  const today = chicagoToday();

  if (name === 'create_quest' || name === 'update_progress' || name === 'submit_completion') {
    if (!hasScope(auth, 'quests:write')) return NextResponse.json({ error: 'Missing quests:write scope' }, { status: 403 });
  } else if (name === 'list_quests' || name === 'get_character_progress') {
    if (!hasScope(auth, 'quests:read')) return NextResponse.json({ error: 'Missing quests:read scope' }, { status: 403 });
  }

  let result: unknown;
  if (name === 'create_quest') {
    const title = typeof args.title === 'string' ? args.title.trim() : '';
    const questType = args.quest_type === undefined ? 'scheduled' : args.quest_type;
    if (!title || title.length > 120 || !domains.includes(String(args.domain)) || !['once', 'daily'].includes(String(args.cadence))) return bad('Invalid quest fields');
    if (questType !== 'scheduled' && questType !== 'goal') return bad('Invalid quest type');
    if (questType === 'goal' && args.cadence !== 'once') return bad('Goals are one-time');
    if (args.due_date !== undefined && !isoDate(args.due_date)) return bad('Invalid due date');
    const date = typeof args.due_date === 'string' ? args.due_date : today;
    const created = await userRpc(actor, 'create_scheduled_quest', 'create_scheduled_quest_as_user', {
      p_title: title,
      p_domain: args.domain,
      p_cadence: args.cadence,
      p_date: date,
      p_quest_type: questType,
    });
    if (created.error || typeof created.data !== 'string') return fail(id, -32000, created.error?.message || 'Quest was not created');
    const instance = await actor.db.from('quest_instances').select('id,due_date').eq('quest_id', created.data).eq('owner_id', auth.userId).maybeSingle();
    if (instance.error) return fail(id, -32000, instance.error.message);
    result = {
      id: created.data,
      title,
      domain: args.domain,
      cadence: args.cadence,
      quest_type: questType,
      due_date: instance.data?.due_date ?? date,
      instance_id: instance.data?.id ?? null,
    };
  } else if (name === 'update_progress') {
    if (typeof args.quest_id !== 'string' || typeof args.note !== 'string') return bad('Quest ID and a progress note are required');
    const note = args.note.trim();
    if (!note || note.length > 1000) return bad('Note must be 1 to 1000 characters');
    const percent = parsePercent(args.percent);
    if (percent === 'invalid') return bad('Percent must be an integer from 0 to 100');
    if (args.instance_id !== undefined && typeof args.instance_id !== 'string') return bad('Invalid instance ID');
    const source = typeof args.source === 'string' && sources.includes(args.source) ? args.source : 'api';
    const saved = await userRpc(actor, 'add_quest_progress', 'add_quest_progress_as_user', {
      p_quest_id: args.quest_id,
      p_note: note,
      p_percent: percent,
      p_instance_id: typeof args.instance_id === 'string' ? args.instance_id : null,
      p_source: source,
    });
    if (saved.error || typeof saved.data !== 'string') return fail(id, -32000, saved.error?.message || 'Progress note was not saved');
    result = { id: saved.data, quest_id: args.quest_id, saved: true, xp_awarded: false };
  } else if (name === 'submit_completion') {
    if (typeof args.quest_id !== 'string' || args.confirmed_complete !== true) return bad('Quest ID and explicit confirmed_complete=true required');
    if (args.due_date !== undefined && !isoDate(args.due_date)) return bad('Invalid due date');
    const quest = await actor.db.from('quests').select('id,cadence,quest_type,scheduled_for,active').eq('id', args.quest_id).eq('owner_id', auth.userId).maybeSingle();
    if (quest.error) return fail(id, -32000, quest.error.message);
    if (!quest.data || quest.data.active !== true) return bad('Quest not found');
    const date = typeof args.due_date === 'string'
      ? args.due_date
      : quest.data.cadence === 'once' && quest.data.scheduled_for
        ? quest.data.scheduled_for
        : today;
    const existing = await actor.db.from('quest_instances').select('id').eq('owner_id', auth.userId).eq('quest_id', quest.data.id).eq('due_date', date).maybeSingle();
    if (existing.error) return fail(id, -32000, existing.error.message);
    let instanceId = existing.data?.id ?? null;
    if (!instanceId) {
      const ensured = await userRpc(actor, 'ensure_quest_instance', 'ensure_quest_instance_as_user', {
        p_quest_id: quest.data.id,
        p_date: date,
      });
      if (ensured.error || typeof ensured.data !== 'string') return fail(id, -32000, ensured.error?.message || 'Instance was not created');
      instanceId = ensured.data;
    }
    const completed = await userRpc(actor, 'set_quest_instance_status', 'set_quest_instance_status_as_user', {
      p_instance_id: instanceId,
      p_action: 'complete',
    });
    if (completed.error) return fail(id, -32000, completed.error.message);
    result = { quest_id: quest.data.id, instance_id: instanceId, recorded: completed.data === 'completed', server_result: completed.data };
  } else if (name === 'list_quests') {
    const date = args.due_date === undefined ? today : args.due_date;
    if (!isoDate(date)) return bad('Invalid due date');
    let instances = actor.db.from('quest_instances').select('id,quest_id,due_date,status').eq('owner_id', auth.userId);
    if (args.include_history !== true) instances = instances.eq('due_date', date);
    const [questRows, instanceRows] = await Promise.all([
      actor.db.from('quests').select('id,title,domain,cadence,quest_type,scheduled_for,active').eq('owner_id', auth.userId).eq('active', true),
      instances.limit(500),
    ]);
    if (questRows.error || instanceRows.error) return fail(id, -32000, questRows.error?.message || instanceRows.error?.message || 'Query failed');
    result = { quests: questRows.data, instances: instanceRows.data };
  } else if (name === 'get_character_progress') {
    const [xp, completed] = await Promise.all([
      userRpc(actor, 'get_lifetime_xp', 'get_lifetime_xp_as_user', {}),
      actor.db.from('quest_instances').select('id', { count: 'exact', head: true }).eq('owner_id', auth.userId).eq('status', 'completed'),
    ]);
    if (xp.error || completed.error) return fail(id, -32000, xp.error?.message || completed.error?.message || 'Query failed');
    result = { lifetime_xp: Number(xp.data ?? 0), completed_instances: completed.count ?? 0 };
  } else {
    return bad('Unknown tool');
  }

  return NextResponse.json({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(result) }] } });
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

async function userRpc(actor: Actor, name: string, asUserName: string, args: Record<string, unknown>): Promise<RpcResult> {
  const query = actor.auth.method === 'api_key'
    ? actor.db.rpc(asUserName, { ...args, p_user_id: actor.auth.userId })
    : actor.db.rpc(name, args);
  return await query as unknown as RpcResult;
}

function chicagoToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function isoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function parsePercent(value: unknown): number | null | 'invalid' {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 100) return 'invalid';
  return value;
}
