import type { NextRequest } from 'next/server';
import { deliverClaim } from '../../../../lib/push/deliver';
import { engagementJson } from '../../../../lib/push/http';
import { pushIsConfigured } from '../../../../lib/push/serverConfig';
import { engagementSession } from '../../../../lib/push/sessionDb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Fire-and-forget drain of outbox rows this signed-in account caused. Never used by quest RPCs. */
export async function POST(request: NextRequest) {
  const session = await engagementSession(request);
  if (!session.configured || !session.db) return engagementJson({ configured: false }, 503, session.pending);
  if (!session.user) return engagementJson({ error: 'Sign in required' }, 401, session.pending);
  if (!pushIsConfigured()) return engagementJson({ configured: false, sent: 0 }, 200, session.pending);
  const { data, error } = await session.db.rpc('push_claim');
  if (error) {
    console.error('push claim failed', error.code ?? 'unknown');
    return engagementJson({ error: 'Could not send notifications' }, 500, session.pending);
  }
  const result = await deliverClaim(session.db, data, null);
  return engagementJson({ configured: true, ...result }, 200, session.pending);
}
