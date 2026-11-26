import { gameDayParts, QUEST_TIME_ZONE } from '../questStreak.ts';
import {
  LIGHTS_OUT_BASE_XP,
  LIGHTS_OUT_LOOKBACK_DAYS,
  LIGHTS_OUT_STREAK_BONUS_XP,
  LIGHTS_OUT_WEEK_GOAL,
  LIGHTS_OUT_WEEK_NIGHTS,
} from './config.ts';
import { shiftDate } from './dates.ts';

export function lightsOutXp(priorConsecutiveNights: number): number {
  const prior = Math.max(0, Math.floor(priorConsecutiveNights));
  return LIGHTS_OUT_BASE_XP + LIGHTS_OUT_STREAK_BONUS_XP * prior;
}

/** Consecutive recorded nights immediately before `gameDay`. The night itself is excluded. */
export function priorLightsOutStreak(recorded: readonly string[], gameDay: string): number {
  const days = new Set(recorded);
  let prior = 0;
  for (let day = shiftDate(gameDay, -1); days.has(day); day = shiftDate(day, -1)) prior += 1;
  return prior;
}

export function healthGameDay(instant: Date, timeZone: string = QUEST_TIME_ZONE): string {
  return gameDayParts(instant, timeZone).date;
}

/** Current game day and the previous two. Health only; not Izzy's 30-day window. */
export function healthRecordWindow(gameDay: string): string[] {
  return Array.from({ length: LIGHTS_OUT_LOOKBACK_DAYS + 1 }, (_, index) => shiftDate(gameDay, -index));
}

export function healthNightAllowed(gameDay: string, today: string): boolean {
  return healthRecordWindow(today).includes(gameDay);
}

export function rollingLightsOutCount(recorded: readonly string[], today: string): number {
  const start = shiftDate(today, -(LIGHTS_OUT_WEEK_NIGHTS - 1));
  return new Set(recorded.filter((day) => day >= start && day <= today)).size;
}

export function lightsOutWeekLabel(count: number): string {
  return `${count} of ${LIGHTS_OUT_WEEK_NIGHTS} nights · Goal ${LIGHTS_OUT_WEEK_GOAL}`;
}

export type LightsOutClaim = { gameDay: string; requestId: string; xp: number };

/**
 * Same-night and same-request claims pay once. A second caller that already
 * sees the winning row gets no XP. The database unique keys are what make two
 * simultaneous inserts resolve the same way.
 */
export function claimLightsOut(
  rows: readonly LightsOutClaim[],
  gameDay: string,
  requestId: string,
): { rows: LightsOutClaim[]; already: boolean; xpAwarded: number } {
  const existing = rows.find((row) => row.gameDay === gameDay || row.requestId === requestId);
  if (existing) return { rows: [...rows], already: true, xpAwarded: 0 };
  const xp = lightsOutXp(priorLightsOutStreak(rows.map((row) => row.gameDay), gameDay));
  return { rows: [...rows, { gameDay, requestId, xp }], already: false, xpAwarded: xp };
}
