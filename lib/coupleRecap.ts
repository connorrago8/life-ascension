/** Sunday recap. Approved: the card appears on the Sunday game day, which starts at
 * 05:00 America/Chicago, and covers the previous seven complete game days
 * (previous Sunday 05:00 through this Sunday 04:59:59).
 * Level steps match lib/level.ts. Kept local so this module has no relative imports. */

export type RecapPartner = {
  role: 'adventurer' | 'companion';
  done: number;
  xp: number;
  levelsGained: number;
  longestStreak: number;
};

function xpToReach(level: number): number {
  if (level <= 1) return 0;
  return (5 * (level * (level + 1) - 2)) / 2;
}

function levelNumber(total: number): number {
  const xp = Math.max(0, Math.floor(total));
  let level = 1;
  while (level < 100000 && xpToReach(level + 1) <= xp) level += 1;
  return level;
}

export function levelsGained(xpBefore: number, xpGained: number): number {
  const before = Math.max(0, Math.floor(xpBefore));
  const gained = Math.floor(xpGained);
  return levelNumber(before + gained) - levelNumber(Math.max(0, before));
}

/** Game-day Sunday. Before 05:00 Chicago it is still Saturday's game day. */
export function isSundayGameDay(gameDay: string): boolean {
  const parsed = new Date(`${gameDay}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.getUTCDay() === 0;
}

function shiftDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Previous Sunday through this Sunday. End is exclusive at this Sunday 05:00. */
export function recapWeek(sundayGameDay: string): { weekStart: string; weekEnd: string } {
  return { weekStart: shiftDays(sundayGameDay, -7), weekEnd: sundayGameDay };
}

export function recapShows(gameDay: string): boolean {
  return isSundayGameDay(gameDay);
}
