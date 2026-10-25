// Daily quests roll at 05:00 civil time. The date is the calendar day of that
// clock time minus the rollover, not of (the UTC instant minus 5 absolute
// hours). Absolute subtraction would open the new day at 06:00 on the
// 23-hour spring-forward morning. Intl supplies the civil clock so the zone
// offset, including DST, stays correct; borrowing a day is Gregorian math.

export const QUEST_TIME_ZONE = 'America/Chicago';
export const DAILY_ROLLOVER_HOUR = 5;

type CivilTime = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): number {
  const value = parts.find((item) => item.type === type)?.value;
  if (value == null) throw new Error(`Missing ${type} from timezone parts`);
  return Number(value);
}

export function civilTime(instant: Date, timeZone = QUEST_TIME_ZONE): CivilTime {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  let hour = part(parts, 'hour');
  if (hour === 24) hour = 0;
  return {
    year: part(parts, 'year'),
    month: part(parts, 'month'),
    day: part(parts, 'day'),
    hour,
    minute: part(parts, 'minute'),
    second: part(parts, 'second'),
  };
}

function isoDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function shiftCalendar(year: number, month: number, day: number, deltaDays: number): { year: number; month: number; day: number } {
  const shifted = new Date(Date.UTC(year, month - 1, day + deltaDays));
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() };
}

/** Calendar date in the zone. This is the server's midnight boundary. */
export function calendarDate(instant: Date = new Date(), timeZone = QUEST_TIME_ZONE): string {
  const civil = civilTime(instant, timeZone);
  return isoDate(civil.year, civil.month, civil.day);
}

/**
 * Active daily quest day. Before the rollover hour this is the previous
 * civil date; at the rollover hour the new date begins.
 */
export function questDay(
  instant: Date = new Date(),
  timeZone = QUEST_TIME_ZONE,
  rolloverHour = DAILY_ROLLOVER_HOUR,
): string {
  const civil = civilTime(instant, timeZone);
  if (civil.hour < rolloverHour) {
    const previous = shiftCalendar(civil.year, civil.month, civil.day, -1);
    return isoDate(previous.year, previous.month, previous.day);
  }
  return isoDate(civil.year, civil.month, civil.day);
}

/** Daily actions use the quest day. One-time quests and goals stay on the calendar date. */
export function questActionDate(cadence: string, instant: Date = new Date(), timeZone = QUEST_TIME_ZONE): string {
  return cadence === 'daily' ? questDay(instant, timeZone) : calendarDate(instant, timeZone);
}

function utcFromCivil(year: number, month: number, day: number, hour: number, minute: number, timeZone: string): Date {
  let utcMillis = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const civil = civilTime(new Date(utcMillis), timeZone);
    const civilAsUtc = Date.UTC(civil.year, civil.month - 1, civil.day, civil.hour, civil.minute, civil.second);
    const desired = Date.UTC(year, month - 1, day, hour, minute, 0);
    const delta = desired - civilAsUtc;
    if (delta === 0) return new Date(utcMillis);
    utcMillis += delta;
  }
  return new Date(utcMillis);
}

/** UTC instant when the next quest day begins. Used to refresh an open board. */
export function nextQuestDayStart(
  instant: Date = new Date(),
  timeZone = QUEST_TIME_ZONE,
  rolloverHour = DAILY_ROLLOVER_HOUR,
): Date {
  const civil = civilTime(instant, timeZone);
  const date = civil.hour < rolloverHour
    ? { year: civil.year, month: civil.month, day: civil.day }
    : shiftCalendar(civil.year, civil.month, civil.day, 1);
  return utcFromCivil(date.year, date.month, date.day, rolloverHour, 0, timeZone);
}
