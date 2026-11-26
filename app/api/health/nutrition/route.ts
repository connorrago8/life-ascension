import { createClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';
import type { NutritionInput } from '../../../../lib/ascension/appleHealth';
import { handleNutritionPost, healthIngestJson, type IngestOutcome } from '../../../../lib/healthIngestApi';
import { readServerSupabaseConfig } from '../../../../lib/supabaseRuntimeConfig';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Cronometer shadow import. 0 XP. The owner is the bearer token, never a user id in the body.
 * Never log the Authorization header, the token, or the body.
 * This route does not call the lights-out award.
 */
export async function POST(request: NextRequest) {
  return handleNutritionPost(request, {
    record: (tokenHash, input, requestId) => record(tokenHash, input, requestId),
  });
}

export async function GET() {
  return healthIngestJson({ error: 'Use POST' }, 405, { Allow: 'POST' });
}

async function record(tokenHash: string, input: NutritionInput, requestId: string): Promise<IngestOutcome> {
  const config = await readServerSupabaseConfig();
  if (!config) return { ok: false, status: 503, error: 'Health ingest is not configured on this deployment' };
  const db = createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await db.rpc('ingest_cronometer_nutrition', {
    p_token_hash: tokenHash,
    p_request_id: requestId,
    p_game_day: input.gameDay,
    p_observed_at: input.observedAt.toISOString(),
    p_basis: input.basis,
    p_read_status: input.readStatus,
    p_energy_kcal: input.energyKcal,
    p_protein_g: input.proteinG,
    p_carbs_g: input.carbsG,
    p_fat_g: input.fatG,
  });
  if (error) {
    console.error('nutrition ingest failed', error.code ?? 'unknown');
    return { ok: false, status: 500, error: 'Could not save nutrition' };
  }
  const row = data as { ok?: boolean; error?: string } | null;
  if (!row || row.ok !== true) {
    const code = row?.error ?? 'invalid';
    if (code === 'unauthorized') return { ok: false, status: 401, error: 'Invalid or revoked token' };
    if (code === 'rate_limited') return { ok: false, status: 429, error: 'Too many requests' };
    if (code === 'duplicate_request_id') return { ok: false, status: 409, error: 'That request id was already used' };
    if (code === 'old_night') return { ok: false, status: 400, error: 'That day is outside the health window' };
    return { ok: false, status: 400, error: 'Nutrition was not saved' };
  }
  return { ok: true, status: 200, body: data as Record<string, unknown> };
}
