import type { NextRequest } from 'next/server';
import { engagementJson } from '../../../../lib/push/http';
import { pushIsConfigured } from '../../../../lib/push/serverConfig';
import { engagementSession } from '../../../../lib/push/sessionDb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const session = await engagementSession(request);
  if (!session.configured || !session.db) return engagementJson({ configured: false, error: 'Server not configured' }, 503, session.pending);
  if (!pushIsConfigured()) return engagementJson({ configured: false }, 200, session.pending);
  if (!session.user) return engagementJson({ error: 'Sign in required' }, 401, session.pending);

  let body: unknown;
  try { body = await request.json(); } catch { return engagementJson({ error: 'Invalid JSON' }, 400, session.pending); }
  const record = body && typeof body === 'object' ? body as { endpoint?: unknown; keys?: unknown } : null;
  const keys = record?.keys && typeof record.keys === 'object' ? record.keys as { p256dh?: unknown; auth?: unknown } : null;
  if (!record || typeof record.endpoint !== 'string' || !keys || typeof keys.p256dh !== 'string' || typeof keys.auth !== 'string') {
    return engagementJson({ error: 'Invalid subscription' }, 400, session.pending);
  }

  const { data, error } = await session.db.rpc('push_subscribe', {
    p_endpoint: record.endpoint,
    p_p256dh: keys.p256dh,
    p_auth: keys.auth,
    p_user_agent: request.headers.get('user-agent'),
  });
  if (error) {
    console.error('push subscribe failed', error.code ?? 'unknown');
    const status = error.message === 'Invalid endpoint' || error.message === 'Invalid subscription keys' ? 400 : 500;
    return engagementJson({ error: status === 400 ? error.message : 'Could not save the subscription' }, status, session.pending);
  }
  return engagementJson({ ok: true, configured: true, id: (data as { id?: string } | null)?.id ?? null }, 200, session.pending);
}
