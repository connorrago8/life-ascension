import { NextRequest, NextResponse } from 'next/server';
import { getVercelOidcToken } from '@vercel/oidc';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { fallbackQuestDrafts, sanitizeQuestDrafts } from '../../../../lib/companionQuestDraft';
import { parseDateNight } from '../../../../lib/dateNightPlan';
import { applyPendingCookies, readSessionUser } from '../../../../lib/supabaseServer';

export const dynamic = 'force-dynamic';

const MAX_INPUT = 1000;
const HOUR_LIMIT = 12;

const draftSchema = z.object({
  items: z.array(z.object({
    title: z.string().max(120),
    note: z.string().max(500),
    cadence: z.enum(['daily', 'weekly']),
  })).max(10),
});

export async function POST(request: NextRequest) {
  const session = await readSessionUser(request);
  if (!session.configured) {
    return applyPendingCookies(NextResponse.json({ items: [], source: 'unconfigured' }, { status: 503 }), session.pendingCookies);
  }
  if (!session.user) {
    return applyPendingCookies(NextResponse.json({ error: 'Sign-in required' }, { status: 401 }), session.pendingCookies);
  }

  let text = '';
  try {
    const body = await request.json() as { text?: unknown };
    text = typeof body.text === 'string' ? body.text : '';
  } catch {
    text = '';
  }
  if (text.trim().length < 1 || text.length > MAX_INPUT) {
    return applyPendingCookies(NextResponse.json({ error: 'Keep the note under 1000 characters.' }, { status: 400 }), session.pendingCookies);
  }

  const { createServerClient } = await import('@supabase/ssr');
  const { readServerSupabaseConfig } = await import('../../../../lib/supabaseRuntimeConfig');
  const config = await readServerSupabaseConfig();
  if (!config) {
    return applyPendingCookies(NextResponse.json({ items: fallbackQuestDrafts(text), source: 'fallback' }), session.pendingCookies);
  }
  const client = createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: () => undefined,
    },
  });
  const bond = await client.from('companion_bonds').select('id').eq('status', 'active')
    .or(`inviter_id.eq.${session.user.id},companion_id.eq.${session.user.id}`)
    .limit(1);
  if (bond.error || !bond.data?.length) {
    return applyPendingCookies(NextResponse.json({ error: 'Companion connection required' }, { status: 403 }), session.pendingCookies);
  }
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const recent = await client.from('companion_parse_log').select('id', { count: 'exact', head: true }).gte('created_at', since);
  if ((recent.count ?? 0) >= HOUR_LIMIT) {
    return applyPendingCookies(NextResponse.json({ items: fallbackQuestDrafts(text), source: 'fallback' }), session.pendingCookies);
  }
  await client.from('companion_parse_log').insert({ user_id: session.user.id });

  const dateNight = parseDateNight(text);
  if (dateNight) {
    return applyPendingCookies(NextResponse.json({ items: [], dateNight, source: 'date-night' }), session.pendingCookies);
  }

  const drafted = await draftWithGateway(text);
  return applyPendingCookies(NextResponse.json(drafted), session.pendingCookies);
}

async function draftWithGateway(text: string): Promise<{ items: ReturnType<typeof fallbackQuestDrafts>; source: 'model' | 'fallback' }> {
  const fallback = fallbackQuestDrafts(text);
  if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN) {
    try {
      const token = await getVercelOidcToken();
      if (!token) return { items: fallback, source: 'fallback' };
    } catch {
      return { items: fallback, source: 'fallback' };
    }
  }
  try {
    const { output } = await generateText({
      model: process.env.AI_GATEWAY_MODEL || 'openai/gpt-5.4-mini',
      output: Output.object({ schema: draftSchema }),
      abortSignal: AbortSignal.timeout(8000),
      prompt: `Turn this note into at most 10 short real-life quests for a partner.
Quick same-day chores (trash, dishwasher, laundry, outfit, clothes on the floor, tidy) are daily.
Bigger, multi-step, or "this week" tasks (cardboard boxes, deep clean, errands) are weekly.
Return plain text only. Keep each original sentence as note.
Note:
${text.slice(0, MAX_INPUT)}`,
    });
    const clean = sanitizeQuestDrafts(output && typeof output === 'object' && 'items' in output ? output.items : output);
    return { items: clean.length > 0 ? clean : fallback, source: clean.length > 0 ? 'model' : 'fallback' };
  } catch {
    return { items: fallback, source: 'fallback' };
  }
}
