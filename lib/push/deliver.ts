import { createHash, timingSafeEqual } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import { pushRequestOptions, type PushPayload } from './payload.ts';
import { readPushEnv } from './serverConfig.ts';
import { subscriptionDisposition } from './subscriptionHealth.ts';

type ClaimSubscription = { id?: unknown; endpoint?: unknown; p256dh?: unknown; auth?: unknown };
type ClaimItem = {
  outboxId?: unknown;
  dedupeKey?: unknown;
  title?: unknown;
  body?: unknown;
  tag?: unknown;
  url?: unknown;
  subscriptions?: unknown;
};

export type DeliverResult = { sent: number; disabled: number; held: number };

export function cronSecretMatches(header: string | null, secret: string | undefined): boolean {
  if (!secret || !header) return false;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  if (!match) return false;
  const presented = Buffer.from(match[1]);
  const expected = Buffer.from(secret);
  if (presented.length !== expected.length) return false;
  return timingSafeEqual(presented, expected);
}

export function cronSecretHash(secret: string): string {
  return createHash('sha256').update(secret, 'utf8').digest('hex');
}

function asItems(data: unknown): ClaimItem[] {
  const row = data && typeof data === 'object' ? data as { ok?: unknown; items?: unknown } : null;
  if (!row || row.ok !== true || !Array.isArray(row.items)) return [];
  return row.items as ClaimItem[];
}

function payloadOf(item: ClaimItem): PushPayload | null {
  if (typeof item.title !== 'string' || typeof item.body !== 'string' || typeof item.tag !== 'string') return null;
  if (typeof item.outboxId !== 'string' || typeof item.dedupeKey !== 'string') return null;
  return {
    title: item.title,
    body: item.body,
    tag: item.tag,
    renotify: false,
    url: typeof item.url === 'string' ? item.url : '/quests',
  };
}

async function sendOne(payload: PushPayload, sub: ClaimSubscription): Promise<number> {
  const env = readPushEnv();
  if (!env.configured || !env.publicKey || !env.privateKey || !env.subject) return 0;
  if (typeof sub.endpoint !== 'string' || typeof sub.p256dh !== 'string' || typeof sub.auth !== 'string') return 0;
  webpush.setVapidDetails(env.subject, env.publicKey, env.privateKey);
  const options = pushRequestOptions(payload);
  try {
    const result = await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
      options,
    );
    return result.statusCode || 201;
  } catch (error) {
    const status = typeof error === 'object' && error && 'statusCode' in error
      ? Number((error as { statusCode?: number }).statusCode)
      : 0;
    if (!status) console.error('push send failed');
    else console.error('push send failed', status);
    return status || 500;
  }
}

/**
 * Send a claim payload. The database already applied quiet hours, preferences,
 * and idempotency. This function only talks to the push service and reports
 * 404/410 back so the subscription can be disabled.
 */
export async function deliverClaim(
  db: SupabaseClient,
  data: unknown,
  cronHash: string | null,
): Promise<DeliverResult> {
  const result: DeliverResult = { sent: 0, disabled: 0, held: 0 };
  const body = data && typeof data === 'object' ? data as { reason?: unknown; held?: unknown } : null;
  if (typeof body?.held === 'number') result.held = body.held;
  for (const item of asItems(data)) {
    const payload = payloadOf(item);
    const subs = Array.isArray(item.subscriptions) ? item.subscriptions as ClaimSubscription[] : [];
    if (!payload || typeof item.outboxId !== 'string' || typeof item.dedupeKey !== 'string') continue;
    let success = false;
    let retry = false;
    for (const sub of subs) {
      const status = await sendOne(payload, sub);
      const action = subscriptionDisposition(status);
      if (action === 'retry') {
        retry = true;
        continue;
      }
      if (typeof sub.id === 'string') {
        await db.rpc('push_subscription_result', {
          p_subscription_id: sub.id,
          p_outbox_id: item.outboxId,
          p_status: status,
          p_cron_hash: cronHash,
        });
      }
      if (action === 'disable') result.disabled += 1;
      if (action === 'success') success = true;
    }
    if (success || (!retry && subs.length > 0)) {
      await db.rpc('push_finalize', {
        p_outbox_id: item.outboxId,
        p_dedupe_key: item.dedupeKey,
        p_cron_hash: cronHash,
      });
      if (success) result.sent += 1;
    } else {
      await db.rpc('push_release', { p_outbox_id: item.outboxId, p_cron_hash: cronHash });
      result.held += 1;
    }
  }
  return result;
}
