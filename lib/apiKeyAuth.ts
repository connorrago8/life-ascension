import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import {
  hashApiKey,
  isPersonalApiKey,
  looksLikeApiKeyAttempt,
  readBearerToken,
  secureCompareHex,
} from './apiKey';
import { createServiceRoleClient } from './supabaseAdmin';

const REALM = 'Bearer realm="life-ascension"';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const JWT_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const ALLOWED_SCOPES = new Set(['quests:read', 'quests:write']);
const ZERO_HASH = '0'.repeat(64);

export type AuthSuccess = {
  ok: true;
  userId: string;
  method: 'api_key' | 'supabase_jwt';
  scopes: string[];
};

export type AuthFailure = {
  ok: false;
  status: 401 | 503;
  error: string;
};

export type AuthResult = AuthSuccess | AuthFailure;

type KeyLookupRow = {
  user_id?: unknown;
  scopes?: unknown;
  key_id?: unknown;
  key_hash?: unknown;
};

/**
 * Authenticate a Bearer credential for server routes such as /api/whoami and, during
 * integration, /api/mcp.
 *
 * Accepts either a personal API key (`la_live_...`) or a Supabase user access token.
 * API keys are SHA-256 hashed and resolved with the service-role client. The plaintext
 * key is never stored or logged. User JWTs are checked with the anon client and the
 * caller's token so `auth.uid()` keeps working on existing RPCs.
 *
 * API-key success does not create a user JWT. `/api/mcp` calls the `*_as_user`
 * wrappers from `202610240005_api_key_user_context.sql` with this `userId`.
 * Those wrappers are service-role only and pin `auth.uid()` for one transaction.
 * See docs/ai-auth.md.
 */
export async function authenticateRequest(req: Request): Promise<AuthResult> {
  if (typeof window !== 'undefined') {
    throw new Error('authenticateRequest is server-only');
  }

  const token = readBearerToken(req.headers.get('authorization'));
  if (!token) return unauthorized('Bearer token required');
  if (looksLikeApiKeyAttempt(token)) {
    if (!isPersonalApiKey(token)) return unauthorized('Invalid or revoked API key');
    return authenticateApiKey(token);
  }
  if (!JWT_PATTERN.test(token) || token.length > 8192) return unauthorized('Invalid or expired user token');
  return authenticateUserJwt(token);
}

export function authenticationErrorResponse(result: AuthFailure): NextResponse {
  const headers: Record<string, string> = { 'Cache-Control': 'no-store' };
  if (result.status === 401) headers['WWW-Authenticate'] = REALM;
  return NextResponse.json({ error: result.error }, { status: result.status, headers });
}

export function hasScope(auth: AuthSuccess, scope: string): boolean {
  return auth.scopes.includes(scope);
}

function unauthorized(error: string): AuthFailure {
  return { ok: false, status: 401, error };
}

function unavailable(error: string): AuthFailure {
  return { ok: false, status: 503, error };
}

function logAuthError(label: string, error: unknown) {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code ?? 'unknown')
    : 'unknown';
  console.error(label, code);
}

async function authenticateApiKey(token: string): Promise<AuthResult> {
  const admin = createServiceRoleClient();
  if (!admin) return unavailable('API key authentication is not configured');

  const digest = hashApiKey(token);
  const { data, error } = await admin.rpc('authenticate_api_key', { p_key_hash: digest });
  if (error) {
    logAuthError('api key lookup failed', error);
    return unavailable('API key authentication failed');
  }

  const row = firstRow(data);
  const storedHash = typeof row?.key_hash === 'string' ? row.key_hash : ZERO_HASH;
  const matches = secureCompareHex(digest, storedHash);
  if (!row || !matches) return unauthorized('Invalid or revoked API key');

  const userId = typeof row.user_id === 'string' ? row.user_id : '';
  const scopes = normalizeScopes(row.scopes);
  if (!UUID_PATTERN.test(userId) || !scopes) return unauthorized('Invalid or revoked API key');

  return { ok: true, userId, method: 'api_key', scopes };
}

async function authenticateUserJwt(token: string): Promise<AuthResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return unavailable('Server not configured');

  try {
    const db = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data, error } = await db.auth.getUser(token);
    if (error || !data.user) return unauthorized('Invalid or expired user token');
    return {
      ok: true,
      userId: data.user.id,
      method: 'supabase_jwt',
      scopes: ['quests:read', 'quests:write'],
    };
  } catch (error) {
    logAuthError('user token lookup failed', error);
    return unavailable('Authentication service unavailable');
  }
}

function firstRow(data: unknown): KeyLookupRow | null {
  if (Array.isArray(data)) {
    const row = data[0];
    return row && typeof row === 'object' ? row as KeyLookupRow : null;
  }
  if (data && typeof data === 'object') return data as KeyLookupRow;
  return null;
}

function normalizeScopes(scopes: unknown): string[] | null {
  if (!Array.isArray(scopes) || scopes.length === 0 || scopes.length > ALLOWED_SCOPES.size) return null;
  if (!scopes.every((scope) => typeof scope === 'string' && ALLOWED_SCOPES.has(scope))) return null;
  return [...new Set(scopes)];
}
