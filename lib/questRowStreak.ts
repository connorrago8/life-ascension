/**
 * Display-only streak for one recurring quest.
 * Counted from that person's own completed due dates. It does not feed XP,
 * the global day streak, or the streak shield.
 *
 * The current period counts when it is completed. If it is still open, a run
 * that ended on the previous period still counts. A missed period resets it.
 */

export type RowCadence = 'daily' | 'weekly' | 'once';
export type RowAccent = 'cyan' | 'magenta' | 'gold' | 'muted';

function addDays(date: string, days: number): string {
  const next = new Date(`${date}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

export function questRowStreak(cadence: RowCadence, completedPeriods: Iterable<string>, currentPeriod: string): number {
  if (cadence === 'once' || !/^\d{4}-\d{2}-\d{2}$/.test(currentPeriod)) return 0;
  const step = cadence === 'weekly' ? 7 : 1;
  const done = new Set(completedPeriods);
  let cursor = done.has(currentPeriod) ? currentPeriod : addDays(currentPeriod, -step);
  let count = 0;
  while (done.has(cursor) && count < 4000) {
    count += 1;
    cursor = addDays(cursor, -step);
  }
  return count;
}

/** Thin accent only. Partner and Together share cyan and win over cadence. */
export function rowAccent(input: { partner?: boolean; together?: boolean; cadence: RowCadence; dueToday?: boolean }): RowAccent {
  if (input.partner || input.together) return 'cyan';
  if (input.cadence === 'weekly') return 'gold';
  if (input.cadence === 'daily' || input.dueToday) return 'magenta';
  return 'muted';
}
