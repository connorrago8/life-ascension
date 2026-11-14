/** What to do with a push service HTTP status. 404 and 410 mean the browser dropped the subscription. */

export type SubscriptionDisposition = 'disable' | 'success' | 'retry';

export function subscriptionDisposition(status: number): SubscriptionDisposition {
  if (status === 404 || status === 410) return 'disable';
  if (status >= 200 && status < 300) return 'success';
  return 'retry';
}
