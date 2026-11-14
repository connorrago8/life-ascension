import { createHash } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { readBearerToken } from '../../../../lib/apiKey';
import { engagementJson } from '../../../../lib/push/http';
import { engagementAnon } from '../../../../lib/push/sessionDb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TOKEN = /^la_widget_[A-Za-z0-9]{32,80}$/;

/**
 * Read-only snapshot for the token's own account. The token is hashed before
 * it reaches the database. Revoked tokens get the same 401 as unknown ones.
 */
export async function GET(request: NextRequest) {
  const token = readBearerToken(request.headers.get('authorization'));
  if (!token || !TOKEN.test(token)) return engagementJson({ error: 'Unauthorized' }, 401);
  const db = await engagementAnon();
  if (!db) return engagementJson({ error: 'Server not configured' }, 503);
  const hash = createHash('sha256').update(token, 'utf8').digest('hex');
  const { data, error } = await db.rpc('widget_read', { p_token_hash: hash });
  if (error) {
    console.error('widget read failed', error.code ?? 'unknown');
    return engagementJson({ error: 'Could not read today' }, 500);
  }
  const row = data as { ok?: boolean; status?: Record<string, unknown> } | null;
  if (!row?.ok || !row.status) return engagementJson({ error: 'Unauthorized' }, 401);
  const status = row.status;
  return engagementJson({
    gameDay: status.gameDay ?? null,
    completed: status.completed ?? 0,
    total: status.total ?? 0,
    remaining: status.remaining ?? 0,
    streak: status.streak ?? 0,
    level: status.level ?? 1,
    xpIntoLevel: status.xpIntoLevel ?? 0,
    xpForNext: status.xpForNext ?? 10,
    lifetimeXp: status.lifetimeXp ?? 0,
  });
}
