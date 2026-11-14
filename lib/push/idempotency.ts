/**
 * One logical send per user, type, and game day.
 * Daily progress is the exception that still replaces a single notification:
 * the tag stays `daily-progress`, and the dedupe key includes the progress
 * fingerprint so an unchanged snapshot is not sent twice, while a new
 * snapshot may replace the previous one.
 */

export const PUSH_KINDS = ['partner_assigned', 'partner_completed', 'streak_at_risk', 'daily_progress'] as const;
export type PushKind = (typeof PUSH_KINDS)[number];

export type DeliveryIdentity = {
  userId: string;
  kind: PushKind;
  gameDay: string;
  dedupeKey: string;
};

export function isPushKind(value: string): value is PushKind {
  return (PUSH_KINDS as readonly string[]).includes(value);
}

/** Fingerprint of the recipient's own snapshot. Same text the SQL claim builds. */
export function dailyProgressFingerprint(state: {
  completed: number;
  total: number;
  streak: number;
  xpIntoLevel: number;
  xpForNext: number;
}): string {
  const n = (value: number) => String(Math.max(0, Math.floor(value)));
  return [n(state.completed), n(state.total), n(state.streak), n(state.xpIntoLevel), n(state.xpForNext)].join('/');
}

/**
 * Dedupe key stored with (user, kind, game day).
 * Non-progress kinds ignore the fingerprint so retries collapse to one row per day.
 */
export function deliveryDedupeKey(kind: PushKind, fingerprint = ''): string {
  if (kind === 'daily_progress') return fingerprint;
  return kind;
}

export function deliveryIdentity(input: {
  userId: string;
  kind: PushKind;
  gameDay: string;
  fingerprint?: string;
}): DeliveryIdentity {
  return {
    userId: input.userId,
    kind: input.kind,
    gameDay: input.gameDay,
    dedupeKey: deliveryDedupeKey(input.kind, input.fingerprint ?? ''),
  };
}

export function sameDelivery(left: DeliveryIdentity, right: DeliveryIdentity): boolean {
  return left.userId === right.userId
    && left.kind === right.kind
    && left.gameDay === right.gameDay
    && left.dedupeKey === right.dedupeKey;
}
