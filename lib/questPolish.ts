import { completionFeedback } from './preview/questReceipt.mjs';

/** XP to float. Only a server receipt that already proves a new award qualifies. */
export function awardStamp(receipt: unknown): unknown {
  if (!receipt || typeof receipt !== 'object') return null;
  return (receipt as { reward_awarded_at?: unknown }).reward_awarded_at;
}

export function confirmedAwardAmount(receipt: unknown, instanceId: string): number | null {
  const text = completionFeedback(receipt, instanceId);
  const match = /Quest completed\. \+(\d+) XP earned/.exec(text);
  if (!match) return null;
  const amount = Number(match[1]);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

/** One float per ledger receipt. A repeat of the same award id does not count again. */
export function claimAward(instanceId: string, awardedAt: unknown, amount: number | null, seen: ReadonlySet<string>): { key: string; amount: number } | null {
  if (!amount || typeof awardedAt !== 'string' || awardedAt.length < 20) return null;
  const key = `${instanceId}:${awardedAt}:${amount}`;
  if (seen.has(key)) return null;
  return { key, amount };
}

export function shouldVibrate(reducedMotion: boolean, amount: number): boolean {
  return reducedMotion === false && amount > 0;
}

type Status = 'available' | 'completed' | 'deferred';

export function withStatus<T extends { id: string; status: Status }>(rows: readonly T[], id: string, status: Status): T[] {
  return rows.map((row) => (row.id === id ? { ...row, status } : row));
}

export function restoreRow<T extends { id: string }>(rows: readonly T[], previous: T | undefined): T[] {
  if (!previous) return [...rows];
  return rows.map((row) => (row.id === previous.id ? previous : row));
}

/** A failed lookup keeps the last good rows for that slice. */
export function sectionSlice<T>(previous: readonly T[], error: { message?: string } | null | undefined, data: readonly T[] | null | undefined): { rows: T[]; error: string | null } {
  if (error) return { rows: [...previous], error: error.message || 'Could not load this section.' };
  return { rows: [...(data ?? [])], error: null };
}

export function emptyCopy(section: 'today' | 'week' | 'upcoming' | 'completed', chip: string): string {
  if (section === 'completed') return 'No completed tasks in this section.';
  if (section === 'upcoming') return 'Nothing scheduled later.';
  if (section === 'week') return chip === 'together' ? 'No shared plans this week.' : 'Nothing else this week.';
  if (chip === 'partner') return 'Nothing from your partner today.';
  if (chip === 'work') return 'No work tasks today.';
  if (chip === 'together') return 'No shared activity today.';
  if (chip === 'life') return 'No life tasks today.';
  return 'Nothing open for today.';
}

/** The caller's own couple award. The two numbers are never added. */
export function callerCoupleAward(role: string | null, result: unknown): number | null {
  if (!result || typeof result !== 'object') return null;
  const row = result as { awarded?: boolean; connorXp?: unknown; izzyXp?: unknown };
  if (row.awarded !== true) return null;
  const raw = role === 'companion' ? row.izzyXp : role === 'adventurer' ? row.connorXp : null;
  return typeof raw === 'number' && Number.isSafeInteger(raw) && raw > 0 ? raw : null;
}
