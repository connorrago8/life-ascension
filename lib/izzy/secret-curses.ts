/**
 * IZ-4 pure policy helpers.
 * These are advisory gates only. The database/API must independently verify
 * assignment provenance, consent, and authoritative occurrence completion.
 */
export type CurseStatus = 'sealed' | 'revealed' | 'fulfilled' | 'forgiven' | 'declined' | 'cancelled';

export type CurseOccurrence = {
  assignmentSource: string;
  dueAt: string;
  completedAt: string | null;
  curseStatus: CurseStatus;
  consentActive: boolean;
};

/** Only an actually missed, consented Izzy assignment may reveal a curse. */
export function shouldRevealCurse(occurrence: CurseOccurrence, now: Date): boolean {
  if (occurrence.assignmentSource !== 'izzy') return false;
  if (!occurrence.consentActive || occurrence.curseStatus !== 'sealed') return false;
  const due = Date.parse(occurrence.dueAt);
  if (!Number.isFinite(due) || now.getTime() <= due) return false;
  if (occurrence.completedAt !== null) {
    const completed = Date.parse(occurrence.completedAt);
    // Invalid completion evidence is not permission to reveal a punishment.
    if (!Number.isFinite(completed)) return false;
    if (completed <= due) return false;
  }
  return true;
}

/** A sealed curse never includes consequence text in Connor-facing payloads. */
export function visibleCursePayload(
  curse: { status: CurseStatus; consequenceText: string; seenAt: string | null },
): { status: CurseStatus; consequenceText?: string; showReveal: boolean } {
  if (curse.status === 'sealed' || curse.status === 'cancelled') {
    return { status: curse.status, showReveal: false };
  }
  return {
    status: curse.status,
    consequenceText: curse.consequenceText,
    showReveal: curse.status === 'revealed' && curse.seenAt === null,
  };
}
