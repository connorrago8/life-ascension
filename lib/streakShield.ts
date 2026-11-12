/** Pure mirror of the monthly streak shield. The database is the authority. */

export type ShieldMap = Map<string, string>;

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function shieldMonth(day: string): string {
  return `${day.slice(0, 7)}-01`;
}

/** The used line names the covered day. A shield spend is never only a silent flag. */
export function shieldLabel(status: 'ready' | 'used', bridgedDay?: string | null): string {
  if (status !== 'used') return 'Streak shield: ready';
  if (bridgedDay && /^\d{4}-\d{2}-\d{2}$/.test(bridgedDay)) {
    const when = new Date(`${bridgedDay}T12:00:00Z`).toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', timeZone: 'UTC',
    });
    return `Streak shield: used. It covered ${when}. That missed day granted no XP.`;
  }
  return 'Streak shield: used. It covered one missed day. That missed day granted no XP.';
}

/**
 * F ending yesterday. A recorded shield, or the one unused shield for that
 * calendar month, bridges exactly one missed day and does not count it.
 * Two missed days in a row stop the walk. A shield never stacks in a month.
 */
export function fireWithShields(completionDays: Iterable<string>, today: string, existing: ShieldMap = new Map()): { fire: number; shields: ShieldMap } {
  const days = new Set(completionDays);
  const shields: ShieldMap = new Map(existing);
  let fire = 0;
  let cursor = addDays(today, -1);
  for (let guard = 0; guard < 4000; guard += 1) {
    if (days.has(cursor)) {
      fire += 1;
      cursor = addDays(cursor, -1);
      continue;
    }
    const behind = addDays(cursor, -1);
    if (!days.has(behind)) break;
    const month = shieldMonth(cursor);
    const recorded = shields.get(month);
    if (recorded === undefined) shields.set(month, cursor);
    if (shields.get(month) !== cursor) break;
    cursor = behind;
  }
  return { fire, shields };
}
