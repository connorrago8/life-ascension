import type { CurseStatus } from './secret-curses';

export type CurseAction = 'acknowledge' | 'fulfill' | 'forgive' | 'decline' | 'cancel';

export type CurseRecord = {
  state: CurseStatus;
  revealedAt: string | null;
  seenAt: string | null;
};

export type CurseTransition =
  | { ok: true; next: CurseRecord; changed: boolean }
  | { ok: false; reason: 'not_revealed' | 'already_resolved' | 'invalid_time' };

/**
 * Pure transition policy for an authenticated server endpoint.
 * Caller MUST independently verify assignment owner, permission to forgive,
 * and that the curse was revealed by the authoritative missed-deadline RPC.
 * These functions do not authorize access to database records.
 */
export function transitionCurse(
  current: CurseRecord,
  action: CurseAction,
  at: string,
): CurseTransition {
  if (!Number.isFinite(Date.parse(at))) return { ok: false, reason: 'invalid_time' };

  if (action === 'cancel') {
    if (current.state === 'cancelled') return { ok: true, next: current, changed: false };
    if (current.state === 'fulfilled' || current.state === 'forgiven' || current.state === 'declined') {
      return { ok: false, reason: 'already_resolved' };
    }
    return { ok: true, next: { ...current, state: 'cancelled' }, changed: true };
  }

  if (current.state === 'sealed') return { ok: false, reason: 'not_revealed' };
  if (current.state !== 'revealed') {
    if (action === 'acknowledge' && current.seenAt !== null) {
      return { ok: true, next: current, changed: false };
    }
    return { ok: false, reason: 'already_resolved' };
  }
  if (current.revealedAt === null) return { ok: false, reason: 'not_revealed' };

  if (action === 'acknowledge') {
    if (current.seenAt !== null) return { ok: true, next: current, changed: false };
    return { ok: true, next: { ...current, seenAt: at }, changed: true };
  }
  const state = { fulfill: 'fulfilled', forgive: 'forgiven', decline: 'declined' } as const;
  return { ok: true, next: { ...current, state: state[action] }, changed: true };
}
