import type { NextRequest } from 'next/server';
import { cronSecretHash, cronSecretMatches, deliverClaim } from '../../../../lib/push/deliver';
import { engagementJson } from '../../../../lib/push/http';
import { pushIsConfigured } from '../../../../lib/push/serverConfig';
import { engagementAnon } from '../../../../lib/push/sessionDb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Daily Hobby cron at 02:00 UTC (8 PM CST / 9 PM CDT), before the default 10 PM quiet hours.
 * Sends the evening streak reminder and any outbox rows the actor's browser did not flush.
 */
export async function GET(request: NextRequest) {
  if (!cronSecretMatches(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return engagementJson({ error: 'Unauthorized' }, 401);
  }
  if (!pushIsConfigured()) return engagementJson({ configured: false, sent: 0 });
  const db = await engagementAnon();
  if (!db) return engagementJson({ configured: false, error: 'Server not configured' }, 503);
  const { data, error } = await db.rpc('push_claim', { p_cron_hash: cronSecretHash(process.env.CRON_SECRET ?? '') });
  if (error) {
    console.error('push cron claim failed', error.code ?? 'unknown');
    return engagementJson({ error: 'Could not send notifications' }, 500);
  }
  const claim = data as { ok?: boolean; reason?: string } | null;
  if (!claim?.ok) return engagementJson({ configured: true, bound: claim?.reason !== 'unbound', reason: claim?.reason ?? 'unauthorized', sent: 0 });
  const result = await deliverClaim(db, data, cronSecretHash(process.env.CRON_SECRET ?? ''));
  return engagementJson({ configured: true, bound: true, ...result });
}
