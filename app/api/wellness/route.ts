import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateRequest } from '../../../lib/apiKeyAuth';
import { readBearerToken } from '../../../lib/apiKey';
import { createServiceRoleClient } from '../../../lib/supabaseAdmin';
import { readServerSupabaseConfig } from '../../../lib/supabaseRuntimeConfig';
import { chicagoDate, handleWellnessPost, wellnessJson, type WellnessInput, type WellnessReading } from '../../../lib/wellnessApi';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/wellness: the Apple Health Shortcut posts {date, sleep_hours, steps}.
 * Auth: Authorization: Bearer <personal API key> (same keys as /api/mcp, Settings → API keys)
 * or a signed-in user's Supabase access token. Upserts one row per Chicago date.
 * Never logs the Authorization header or the key; errors log only a database error code.
 */
export async function POST(request: NextRequest) {
  return handleWellnessPost(request, {
    authenticate: authenticateRequest,
    today: () => chicagoDate(),
    record: async (auth, input) => {
      const args = rpcArgs(input);
      if (auth.method === 'api_key') {
        const admin = createServiceRoleClient();
        if (!admin) return { ok: false, status: 503, error: 'Wellness API is not configured on this deployment' };
        const { data, error } = await admin.rpc('record_wellness_reading_as_user', { p_user_id: auth.userId, ...args });
        return error ? failure(error) : success(data);
      }
      const config = await readServerSupabaseConfig();
      const token = readBearerToken(request.headers.get('authorization'));
      if (!config || !token) return { ok: false, status: 503, error: 'Server not configured' };
      const db = createClient(config.url, config.key, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data, error } = await db.rpc('record_wellness_reading', args);
      return error ? failure(error) : success(data);
    },
  });
}

export async function GET() {
  return wellnessJson({ error: 'Use POST with JSON {"date":"YYYY-MM-DD","sleep_hours":7.5,"steps":8000}' }, 405, { Allow: 'POST' });
}

function rpcArgs(input: WellnessInput) {
  return { p_date: input.date, p_sleep_hours: input.sleepHours, p_steps: input.steps, p_source: input.source };
}

function success(data: unknown): { ok: true; reading: WellnessReading } | { ok: false; status: number; error: string } {
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined;
  if (!row || typeof row.reading_date !== 'string') return { ok: false, status: 500, error: 'Could not save the wellness reading' };
  const num = (value: unknown) => (value === null || value === undefined ? null : Number(value));
  return {
    ok: true,
    reading: {
      date: row.reading_date,
      sleep_hours: num(row.sleep_hours),
      steps: num(row.steps),
      source: String(row.source ?? ''),
      updated_at: typeof row.updated_at === 'string' ? row.updated_at : null,
    },
  };
}

function failure(error: { code?: string; message?: string }) {
  // 22023 = the reading failed a server-side range check; its message is safe to return.
  if (error.code === '22023') return { ok: false as const, status: 400, error: error.message ?? 'Invalid wellness reading' };
  if (error.code === '28000') return { ok: false as const, status: 401, error: 'Authentication required' };
  console.error('wellness reading save failed', error.code ?? 'unknown');
  return { ok: false as const, status: 500, error: 'Could not save the wellness reading' };
}
