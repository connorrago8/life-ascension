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

/** Proposal default. The exact monthly reset instant is not founder-signed. */
export const SHIELD_RESET_PROPOSAL = 'chicago_5am_on_the_1st';

/** Player copy from pack v2 section 5. The shield is 1 per month and grants no XP. */
export const SHIELD_READY = 'Streak Shield ready · 1 this month';
export const SHIELD_USED = 'Streak Shield used · 0 remaining';
export const SHIELD_PROTECTED = 'Streak protected. You missed a day, but your journey continues. No XP was awarded.';
export const SHIELD_NUDGE = 'Your shield saved your streak. Complete a quest today to keep it going.';
export const SHIELD_NONE_LEFT = 'No shields left this month. Your next qualifying day starts a new streak.';

export function shieldLabel(status: 'ready' | 'used', options?: { doneToday?: boolean; blocked?: boolean }): string {
  if (status !== 'used') return SHIELD_READY;
  if (options?.blocked) return `${SHIELD_USED} ${SHIELD_NONE_LEFT}`;
  const lines = [SHIELD_USED, SHIELD_PROTECTED];
  if (!options?.doneToday) lines.push(SHIELD_NUDGE);
  return lines.join(' ');
}

/**
 * F ending yesterday. Only a recorded, explicitly confirmed shield bridges a missed day.
 * The protected day does not count as a completion.
 * Two missed days in a row stop the walk. A shield never stacks in a month.
 * IMPORTANT: This function is read-only. An unused shield MUST NOT be spent
 * or inferred without Connor's explicit confirmation. Only `existing` contains
 * confirmed bridge receipts. The database must enforce the same rule.
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
    if (recorded !== cursor) break;
    cursor = behind;
  }
  return { fire, shields };
}
