import { shouldRevealCurse, visibleCursePayload, type CurseOccurrence, type CurseStatus } from './secret-curses';
import { transitionCurse, type CurseAction, type CurseRecord } from './curse-transitions';

export type CurseIdentity = {
  curseId: string;
  ownerUserId: string;
  questId: string;
};

export type VerifiedCurse = CurseIdentity & {
  occurrence: CurseOccurrence;
  consequenceText: string;
  questTitle: string;
  seenAt: string | null;
  revealedAt: string | null;
};

/**
 * Only a trusted backend adapter may implement these operations.
 * loadVerified must verify the signed-in owner, real Izzy assignment provenance,
 * consent, and server-derived occurrence completion/deadline.
 * All mutations must be conditional, atomic, and idempotent in the database.
 */
export interface CurseAuthority {
  loadVerified(ownerUserId: string, curseId: string): Promise<VerifiedCurse | null>;
  revealIfStillMissed(ownerUserId: string, curseId: string, now: string): Promise<VerifiedCurse | null>;
  applyTransition(
    ownerUserId: string,
    curseId: string,
    expected: CurseRecord,
    next: CurseRecord,
  ): Promise<boolean>;
}

export type CurseServiceResult =
  | { status: 'not_found' | 'not_due' | 'conflict' | 'invalid_action' }
  | { status: 'ok'; changed: boolean; curse: ReturnType<typeof visibleCursePayload> };

/**
 * Does not expose sealed consequence text. Authorization and concurrency are
 * delegated to a verified, transactional database adapter.
 */
export async function inspectCurse(
  authority: CurseAuthority,
  ownerUserId: string,
  curseId: string,
  now: Date,
): Promise<CurseServiceResult> {
  let curse = await authority.loadVerified(ownerUserId, curseId);
  if (!curse) return { status: 'not_found' };
  if (shouldRevealCurse(curse.occurrence, now)) {
    curse = await authority.revealIfStillMissed(ownerUserId, curseId, now.toISOString());
    if (!curse) return { status: 'conflict' };
  }
  return {
    status: 'ok',
    changed: false,
    curse: visibleCursePayload({
      status: curse.occurrence.curseStatus,
      consequenceText: curse.consequenceText,
      seenAt: curse.seenAt,
    }),
  };
}

export async function resolveCurse(
  authority: CurseAuthority,
  ownerUserId: string,
  curseId: string,
  action: CurseAction,
  now: Date,
): Promise<CurseServiceResult> {
  if (!Number.isFinite(now.getTime())) return { status: 'invalid_action' };
  const curse = await authority.loadVerified(ownerUserId, curseId);
  if (!curse) return { status: 'not_found' };
  const expected: CurseRecord = {
    state: curse.occurrence.curseStatus,
    revealedAt: curse.revealedAt,
    seenAt: curse.seenAt,
  };
  const result = transitionCurse(expected, action, now.toISOString());
  if (!result.ok) return { status: 'invalid_action' };
  if (result.changed) {
    const applied = await authority.applyTransition(ownerUserId, curseId, expected, result.next);
    if (!applied) return { status: 'conflict' };
  }
  return {
    status: 'ok',
    changed: result.changed,
    curse: visibleCursePayload({
      status: result.next.state as CurseStatus,
      consequenceText: curse.consequenceText,
      seenAt: result.next.seenAt,
    }),
  };
}
