import { NextRequest, NextResponse } from 'next/server';
import { cleanKeyName, generateApiKey } from '../../../lib/apiKey';
import { createServiceRoleClient } from '../../../lib/supabaseAdmin';
import { applyPendingCookies, readSessionUser } from '../../../lib/supabaseServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_ACTIVE_KEYS = 20;
const MAX_STORED_KEYS = 100;
const DEFAULT_SCOPES = ['quests:read', 'quests:write'];

export async function POST(request: NextRequest) {
  const session = await readSessionUser(request);
  if (!session.configured) {
    return json({ error: 'Server not configured' }, 503, session.pendingCookies);
  }
  if (!session.user) {
    return json({ error: 'Sign in required' }, 401, session.pendingCookies);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400, session.pendingCookies);
  }
  if (!isRecord(body)) return json({ error: 'Invalid JSON' }, 400, session.pendingCookies);

  const name = cleanKeyName(body.name);
  if (!name) return json({ error: 'Name must be 1 to 80 characters' }, 400, session.pendingCookies);

  const admin = createServiceRoleClient();
  if (!admin) {
    return json({ error: 'API key creation is not configured' }, 503, session.pendingCookies);
  }

  const { data: existing, error: listError } = await admin
    .from('api_keys')
    .select('revoked_at')
    .eq('user_id', session.user.id)
    .limit(MAX_STORED_KEYS + 1);
  if (listError) {
    console.error('api key list failed', listError.code);
    return json({ error: 'Unable to create an API key' }, 500, session.pendingCookies);
  }

  const rows = existing ?? [];
  const active = rows.filter((row) => row.revoked_at == null).length;
  if (active >= MAX_ACTIVE_KEYS) {
    return json({ error: 'Revoke an unused key before creating another. Active key limit is 20.' }, 409, session.pendingCookies);
  }
  if (rows.length >= MAX_STORED_KEYS) {
    return json({ error: 'API key history is full.' }, 409, session.pendingCookies);
  }

  const inserted = await insertKey(admin, session.user.id, name);
  if (!inserted.ok) return json({ error: inserted.error }, inserted.status, session.pendingCookies);

  return json({
    id: inserted.row.id,
    name: inserted.row.name,
    prefix: inserted.row.prefix,
    scopes: inserted.row.scopes,
    created_at: inserted.row.created_at,
    api_key: inserted.token,
  }, 201, session.pendingCookies);
}

type InsertedKey = {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  created_at: string;
};

async function insertKey(
  admin: NonNullable<ReturnType<typeof createServiceRoleClient>>,
  userId: string,
  name: string,
): Promise<{ ok: true; row: InsertedKey; token: string } | { ok: false; status: number; error: string }> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const key = generateApiKey();
    const { data, error } = await admin
      .from('api_keys')
      .insert({
        user_id: userId,
        name,
        prefix: key.prefix,
        key_hash: key.keyHash,
        scopes: DEFAULT_SCOPES,
      })
      .select('id,name,prefix,scopes,created_at')
      .single();
    if (!error && data && isInsertedKey(data)) return { ok: true, row: data, token: key.token };
    if (error?.code !== '23505') {
      console.error('api key insert failed', error?.code ?? 'unknown');
      return { ok: false, status: 500, error: 'Unable to create an API key' };
    }
  }
  console.error('api key insert failed', '23505');
  return { ok: false, status: 500, error: 'Unable to create an API key' };
}

function json(body: Record<string, unknown>, status: number, pendingCookies: Parameters<typeof applyPendingCookies>[1]) {
  const response = NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
  return applyPendingCookies(response, pendingCookies);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isInsertedKey(value: unknown): value is InsertedKey {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string'
    && typeof value.name === 'string'
    && typeof value.prefix === 'string'
    && typeof value.created_at === 'string'
    && Array.isArray(value.scopes)
    && value.scopes.every((scope) => typeof scope === 'string')
    && !('key_hash' in value)
    && !('api_key' in value);
}
