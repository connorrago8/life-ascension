/**
 * Quiet hours and the evening streak window.
 * Defaults: 10:00 PM–7:00 AM America/Chicago. A window that crosses midnight
 * is quiet from the start until midnight and from midnight until the end.
 * Equal start and end means quiet hours are off.
 * The SQL claim path mirrors these inequalities.
 */

export const QUEST_TIME_ZONE = 'America/Chicago';
export const DEFAULT_QUIET_START = '22:00';
export const DEFAULT_QUIET_END = '07:00';
/** Evening reminder is 7:00 PM inclusive through 10:00 PM exclusive, local. */
export const EVENING_START_MINUTES = 19 * 60;
export const EVENING_END_MINUTES = 22 * 60;

const CLOCK = /^([01]\d|2[0-3]):([0-5]\d)$/;

export type QuietHours = { start: string; end: string; timeZone?: string };

export function parseClock(value: string): number | null {
  const match = CLOCK.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** Minutes since local midnight. Hour 24 from some ICU builds is midnight. */
export function minutesInZone(instant: Date, timeZone: string = QUEST_TIME_ZONE): number {
  if (!Number.isFinite(instant.getTime())) throw new RangeError('Invalid timestamp');
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(instant);
  const rawHour = Number(parts.find((part) => part.type === 'hour')?.value);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value);
  if (!Number.isInteger(rawHour) || !Number.isInteger(minute)) throw new RangeError('Invalid local time');
  const hour = rawHour === 24 ? 0 : rawHour;
  return hour * 60 + minute;
}

export function isQuietHours(instant: Date, quiet: QuietHours = {
  start: DEFAULT_QUIET_START, end: DEFAULT_QUIET_END, timeZone: QUEST_TIME_ZONE,
}): boolean {
  const start = parseClock(quiet.start);
  const end = parseClock(quiet.end);
  if (start === null || end === null || start === end) return false;
  const minutes = minutesInZone(instant, quiet.timeZone || QUEST_TIME_ZONE);
  if (start < end) return minutes >= start && minutes < end;
  return minutes >= start || minutes < end;
}

export function isEveningReminderWindow(instant: Date, timeZone: string = QUEST_TIME_ZONE): boolean {
  const minutes = minutesInZone(instant, timeZone);
  return minutes >= EVENING_START_MINUTES && minutes < EVENING_END_MINUTES;
}

/**
 * Streak reminders send only inside the evening window and outside quiet hours.
 * Before 7 PM the reminder waits. At 10 PM or later it is dropped for that game day.
 */
export function streakReminderDecision(instant: Date, quiet: QuietHours = {
  start: DEFAULT_QUIET_START, end: DEFAULT_QUIET_END, timeZone: QUEST_TIME_ZONE,
}): 'send' | 'wait' | 'drop' {
  const timeZone = quiet.timeZone || QUEST_TIME_ZONE;
  const minutes = minutesInZone(instant, timeZone);
  if (minutes >= EVENING_END_MINUTES) return 'drop';
  if (minutes < EVENING_START_MINUTES) return 'wait';
  if (isQuietHours(instant, { ...quiet, timeZone })) return 'wait';
  return 'send';
}
