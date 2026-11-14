import type { NextRequest } from 'next/server';
import { engagementJson } from '../../../../lib/push/http';
import { engagementSession } from '../../../../lib/push/sessionDb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const session = await engagementSession(request);
  if (!session.configured || !session.db) return engagementJson({ error: 'Server not configured' }, 503, session.pending);
  if (!session.user) return engagementJson({ error: 'Sign in required' }, 401, session.pending);
  let body: unknown;
  try { body = await request.json(); } catch { return engagementJson({ error: 'Invalid JSON' }, 400, session.pending); }
  const endpoint = body && typeof body === 'object' ? (body as { endpoint?: unknown }).endpoint : null;
  if (typeof endpoint !== 'string') return engagementJson({ error: 'Invalid subscription' }, 400, session.pending);
  const { error } = await session.db.rpc('push_unsubscribe', { p_endpoint: endpoint });
  if (error) {
    console.error('push unsubscribe failed', error.code ?? 'unknown');
    return engagementJson({ error: 'Could not remove the subscription' }, 500, session.pending);
  }
  return engagementJson({ ok: true }, 200, session.pending);
}
