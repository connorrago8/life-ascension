import { GAME_DAY_START_MINUTES, QUEST_TIME_ZONE, localParts } from './questStreak.ts';

/** Minutes until the next 05:00 America/Chicago game-day boundary. */
export function minutesUntilGameDayReset(instant: Date, timeZone: string = QUEST_TIME_ZONE): number {
  const local = localParts(instant, timeZone);
  if (local.minutes < GAME_DAY_START_MINUTES) return GAME_DAY_START_MINUTES - local.minutes;
  return (24 * 60 - local.minutes) + GAME_DAY_START_MINUTES;
}

/** Compact countdown such as `6h 12m`. Hours stay visible so 5:00 reads `24h 0m`. */
export function formatResetCountdown(totalMinutes: number): string {
  const minutes = Math.max(0, Math.floor(totalMinutes));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours}h ${rest}m`;
}
