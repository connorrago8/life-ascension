import { shiftDate } from '../ascension/dates.ts';
import { healthGameDay } from '../ascension/lightsOut.ts';
import { localParts } from '../questStreak.ts';

export const NUTRITION_DIARY_LOOKBACK_DAYS = 14;

export function nutritionToday(now: Date): string {
  return healthGameDay(now);
}

export function nutritionDiaryWindow(gameDay: string): string[] {
  return Array.from({ length: NUTRITION_DIARY_LOOKBACK_DAYS + 1 }, (_, index) => shiftDate(gameDay, -index));
}

export function nutritionDateAllowed(diaryDate: string, today: string): boolean {
  return nutritionDiaryWindow(today).includes(diaryDate);
}

export function previousGameDay(now: Date): string {
  return shiftDate(nutritionToday(now), -1);
}

/** Midnight before 5:00 AM Chicago already belongs to the previous calendar date's game day. */
export function loggingClockIsBeforeGameDayStart(now: Date): boolean {
  return localParts(now, 'America/Chicago').minutes < 5 * 60;
}
