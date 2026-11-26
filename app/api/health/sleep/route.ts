import { createClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';
import type { HealthIngestBody } from '../../../../lib/ascension/appleHealth';
import { handleHealthIngestPost, healthIngestJson, type IngestOutcome } from '../../../../lib/healthIngestApi';
import { readServerSupabaseConfig } from '../../../../lib/supabaseRuntimeConfig';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Apple Health shortcut. Bearer ingest token only. Sleep uses the existing
 * lights-out award. Nutrition is stored for the owner and awards 0 XP.
 * Never log the Authorization header, the token, or the body.
 */
export async function POST(request: NextRequest) {
  return handleHealthIngestPost(request, {
    now: () => new Date(),
    ingest: (tokenHash, input) => record(tokenHash, input),
  });
}

export async function GET() {
  return healthIngestJson({ error: 'Use POST' }, 405, { Allow: 'POST' });
}

async function record(tokenHash: string, input: HealthIngestBody): Promise<IngestOutcome> {
  const config = await readServerSupabaseConfig();
  if (!config) return { ok: false, status: 503, error: 'Health ingest is not configured on this deployment' };
  const db = createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await db.rpc('ingest_apple_health', {
    p_token_hash: tokenHash,
    p_request_id: input.requestId,
    p_sleep_start: input.sleep ? input.sleep.start.toISOString() : null,
    p_sleep_end: input.sleep ? input.sleep.end.toISOString() : null,
    p_source: input.sleep ? 'apple_health' : null,
    p_sleep_source_name: input.sleep?.sourceName ?? null,
  });
  if (error) {
    console.error('health ingest failed', error.code ?? 'unknown');
    return { ok: false, status: 500, error: 'Could not save Apple Health data' };
  }
  const row = (data && typeof data === 'object' ? data : null) as { ok?: boolean; error?: string; xp_awarded?: number } | null;
  if (!row || row.ok !== true) {
    const code = row?.error ?? 'invalid';
    if (code === 'unauthorized') return { ok: false, status: 401, error: 'Invalid or revoked token' };
    if (code === 'rate_limited') return { ok: false, status: 429, error: 'Too many requests' };
    if (code === 'duplicate_request_id') return { ok: false, status: 409, error: 'That request id was already used' };
    if (code === 'old_night') return { ok: false, status: 400, error: 'That day is outside the health window' };
    return { ok: false, status: 400, error: 'Apple Health data was not saved' };
  }
  return { ok: true, status: 200, body: data as Record<string, unknown> };
}
