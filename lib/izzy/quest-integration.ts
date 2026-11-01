/**
 * Izzy quest identity is deliberately separate from user-editable quest labels.
 * A companion assignment must be linked to a real quest instance only after
 * trusted approval; imported Tally text alone is never proof of assignment.
 */
export type VerifiedIzzyAssignment = {
  assignmentId: string;
  ownerId: string;
  questId: string;
  instanceId: string;
  origin: 'izzy';
  approved: true;
  consentActive: boolean;
  dueAt: string;
  completedAt: string | null;
};

export type QuestCurseEligibility =
  | { eligible: true; instanceId: string; dueAt: string }
  | { eligible: false; reason: 'unverified' | 'not_izzy' | 'no_consent' | 'invalid_deadline' | 'completed_on_time' };

export function evaluateIzzyCurseEligibility(
  assignment: VerifiedIzzyAssignment | null,
  now: Date,
): QuestCurseEligibility {
  if (!assignment || assignment.approved !== true || !assignment.instanceId || !assignment.questId || !assignment.ownerId) {
    return { eligible: false, reason: 'unverified' };
  }
  if (assignment.origin !== 'izzy') return { eligible: false, reason: 'not_izzy' };
  if (!assignment.consentActive) return { eligible: false, reason: 'no_consent' };
  const due = Date.parse(assignment.dueAt);
  if (!Number.isFinite(now.getTime()) || !Number.isFinite(due) || now.getTime() <= due) {
    return { eligible: false, reason: 'invalid_deadline' };
  }
  if (assignment.completedAt !== null) {
    const completed = Date.parse(assignment.completedAt);
    if (!Number.isFinite(completed)) return { eligible: false, reason: 'unverified' };
    if (completed <= due) return { eligible: false, reason: 'completed_on_time' };
  }
  return { eligible: true, instanceId: assignment.instanceId, dueAt: assignment.dueAt };
}

/**
 * Display labels are hints, not XP authority. Actual +2 XP is awarded only
 * through a server-side, exactly-once completion ledger.
 */
export function questXpLabel(origin: 'izzy' | 'manual' | 'auto'): string {
  return origin === 'izzy' ? '+2 XP' : '+1 XP';
}
