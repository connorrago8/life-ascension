/**
 * Quest board rules shared by the UI and mirrored exactly in SQL
 * (supabase/migrations/202610310001_quest_streaks_weekly.sql). The server is the
 * authority: it awards XP and enforces the weekly window; this module only lets
 * the board show the same numbers without a round trip.
 *
 * Founder rules (t672u; base XP revised in t673u; game day starts at 05:00):
 *  - A game day starts at 05:00 local time. A completion at 01:00 counts for the
 *    previous game day. Fire F = consecutive game days, ending yesterday, with at
 *    least one completion. Today never counts toward F, so F is fixed all game day.
 *    A game day with none resets it.
 *  - The first completion of a game day keeps the streak and gets no bonus.
 *    Every other completion that day earns round(xp × (1 + 0.10 × F)), half up,
 *    computed in integers as (xp × (10 + F) + 5) floor-divided by 10. No cap.
 *    Normal quest, manual/off-board and weekly completions all use base 10 XP.
 *  - Daily board: up to DAILY_BOARD_SIZE daily quests a game day, picked per user
 *    per game day (stable across reloads). Off-board completions still count.
 *  - The week runs Monday 05:00 to the next Monday 05:00. Weekly quests appear at
 *    a seeded time between Monday 05:00 and Thursday 12:00 local and stay until
 *    done or the next Monday 05:00.
 *  - Local time: the profile's time zone when one is stored; today there is no such
 *    column, so every account uses America/Chicago. The server enforces the same
 *    05:00 boundary (public.quest_game_day).
 */

export const QUEST_TIME_ZONE = 'America/Chicago';
export const QUEST_BASE_XP = 10;
export const DAILY_BOARD_SIZE = 5;
/** Game day starts at 05:00 local, not midnight. */
export const GAME_DAY_START_MINUTES = 5 * 60;
/** Monday 05:00 to Thursday 12:00 = 79 hours. Thursday noon stays the latest appear time. */
export const WEEKLY_WINDOW_MINUTES = 79 * 60;

/** 32-bit FNV-1a over UTF-8 bytes. Same as public.quest_fnv1a in SQL. */
export function fnv1a32(text: string): number {
  const bytes = new TextEncoder().encode(text);
  let hash = 0x811c9dc5;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** XP for any positive integer base. Integer math only; nearest integer, half up. */
export function streakXp(base: number, fire: number, firstOfDay: boolean): number {
  const b = Math.max(0, Math.floor(base));
  const f = Math.max(0, Math.floor(fire));
  if (firstOfDay) return b;
  return Math.floor((b * (10 + f) + 5) / 10);
}

/** Bonus percent shown in the hint ("next quests +70%"). */
export function streakBonusPercent(fire: number): number {
  return Math.max(0, Math.floor(fire)) * 10;
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** F from the set of local days that had a completion. Today is ignored. */
export function fireFromDays(daysWithCompletion: Iterable<string>, today: string): number {
  const days = new Set(daysWithCompletion);
  let fire = 0;
  for (let day = addDays(today, -1); days.has(day); day = addDays(day, -1)) fire += 1;
  return fire;
}

/** Local calendar date (YYYY-MM-DD) and minutes since local midnight. Not the game day. */
export function localParts(instant: Date, timeZone: string = QUEST_TIME_ZONE): { date: string; minutes: number; isoDow: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short',
  }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const date = `${get('year')}-${get('month')}-${get('day')}`;
  const minutes = Number(get('hour')) * 60 + Number(get('minute'));
  const isoDow = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(get('weekday')) + 1;
  return { date, minutes, isoDow };
}

/**
 * Game day for an instant. `date` is the game-day calendar date (05:00–next 05:00).
 * `minutes` is minutes since 05:00 local, so Monday 05:00 is minute 0 of that week.
 */
export function gameDayParts(instant: Date, timeZone: string = QUEST_TIME_ZONE): { date: string; minutes: number; isoDow: number } {
  const local = localParts(instant, timeZone);
  if (local.minutes >= GAME_DAY_START_MINUTES) {
    return { date: local.date, minutes: local.minutes - GAME_DAY_START_MINUTES, isoDow: local.isoDow };
  }
  return {
    date: addDays(local.date, -1),
    minutes: local.minutes + (24 * 60 - GAME_DAY_START_MINUTES),
    isoDow: local.isoDow === 1 ? 7 : local.isoDow - 1,
  };
}

/** Monday of the week containing `date` (ISO weeks, Monday first). */
export function weekStart(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  const isoDow = ((d.getUTCDay() + 6) % 7) + 1;
  return addDays(date, 1 - isoDow);
}

/** Minutes after Monday 05:00 local when a weekly quest appears. Same as SQL. */
export function weeklyAppearOffset(userId: string, questId: string, week: string): number {
  return fnv1a32(`${userId}:${questId}:${week}`) % WEEKLY_WINDOW_MINUTES;
}

/** Minutes since Monday 05:00 of `date`'s week. `minutesOfDay` is minutes since 05:00 on that game day. */
export function minutesIntoWeek(date: string, minutesOfDay: number): number {
  const days = Math.round((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${weekStart(date)}T12:00:00Z`)) / 86_400_000);
  return days * 1440 + minutesOfDay;
}

/** Whether a weekly quest is on this week's board. `date` is the game day and `minutesOfDay` is minutes since 05:00. Companion one-shots skip the seeded reveal and are open for the whole week. */
export function weeklyVisible(userId: string, questId: string, date: string, minutesOfDay: number, immediate = false): boolean {
  if (immediate) return true;
  const week = weekStart(date);
  return minutesIntoWeek(date, minutesOfDay) >= weeklyAppearOffset(userId, questId, week);
}

/** "Thu 9:41 AM" style label for when a weekly quest appears. Offset is minutes after Monday 05:00. */
export function weeklyAppearLabel(offset: number): string {
  const fromMidnight = offset + GAME_DAY_START_MINUTES;
  const day = ['Mon', 'Tue', 'Wed', 'Thu'][Math.floor(fromMidnight / 1440)] ?? 'Thu';
  const minutes = fromMidnight % 1440;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${day} ${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/** Today's daily board: all daily quests if there are DAILY_BOARD_SIZE or fewer, else a seeded pick. */
export function dailyBoardIds(userId: string, date: string, dailyQuestIds: readonly string[], size: number = DAILY_BOARD_SIZE): Set<string> {
  const unique = [...new Set(dailyQuestIds)];
  if (unique.length <= size) return new Set(unique);
  const ranked = unique
    .map((id) => ({ id, rank: fnv1a32(`${userId}:${date}:${id}`) }))
    .sort((a, b) => a.rank - b.rank || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return new Set(ranked.slice(0, size).map((entry) => entry.id));
}

export type StreakState = { fire: number; doneToday: boolean; today: string; timeZone: string };

/** Validates get_quest_streak()'s response; anything odd hides the badge. */
export function parseStreak(value: unknown): StreakState | null {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const fire = typeof r.fire === 'number' ? r.fire : typeof r.fire === 'string' && /^\d+$/.test(r.fire) ? Number(r.fire) : NaN;
  if (!Number.isSafeInteger(fire) || fire < 0) return null;
  if (typeof r.done_today !== 'boolean' || typeof r.today !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.today)) return null;
  return { fire, doneToday: r.done_today, today: r.today, timeZone: typeof r.time_zone === 'string' ? r.time_zone : QUEST_TIME_ZONE };
}

/** The badge's hint line, using the server's base-B rule. */
export function streakHint(state: StreakState, base: number = QUEST_BASE_XP): string {
  if (!state.doneToday) return state.fire > 0 ? 'First quest today keeps the streak' : 'Finish a quest today to light the fire';
  const pct = streakBonusPercent(state.fire);
  if (pct === 0) return 'Streak kept today';
  const next = streakXp(base, state.fire, false);
  return `🔥 ${state.fire} · next quests ${next} XP`;
}
