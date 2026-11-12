/** Deterministic date-night parser. Untrusted text may only become a title, 2–5 steps, and a due slot. */

export type DateNightDue = {
  weekday: number;
  hour: number;
  minute: number;
};

export type DateNightPlan = {
  title: string;
  steps: string[];
  due: DateNightDue;
};

const MAX_INPUT = 1000;
const WEEKDAY_NAMES = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

const WEEKDAY_PATTERN = /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tonight|tomorrow)\b/i;
const TIME_PATTERN = /\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i;

function plain(value: string, max: number): string {
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/[^A-Za-z0-9\s'&.,:-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function isoDow(now: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, weekday: 'short' }).formatToParts(now);
  const weekday = parts.find((part) => part.type === 'weekday')?.value ?? '';
  const index = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(weekday);
  return index + 1;
}

function capitalize(value: string): string {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function hourOnClock(hour: number, minute: number, meridiem: string | undefined): { hour: number; minute: number } | null {
  if (minute < 0 || minute > 59 || hour < 0 || hour > 23) return null;
  if (meridiem) {
    const mark = meridiem.toLowerCase();
    if (hour < 1 || hour > 12) return null;
    if (mark === 'am') return { hour: hour === 12 ? 0 : hour, minute };
    return { hour: hour === 12 ? 12 : hour + 12, minute };
  }
  if (hour > 23) return null;
  if (hour >= 13) return { hour, minute };
  if (hour === 0) return { hour: 0, minute };
  // A bare evening hour: "at 7" is 19:00. Noon stays 12:00.
  if (hour === 12) return { hour: 12, minute };
  return { hour: hour + 12, minute };
}

/** Split a cleaned phrase into 2–5 steps. Anything outside that range is not a plan. */
export function dateNightSteps(phrase: string): string[] | null {
  const parts = phrase
    .split(/\s*(?:,|&|\band\b|\bthen\b|\+)\s*/i)
    .map((part) => capitalize(plain(part, 120)))
    .filter((part) => part.length > 0);
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const key = part.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(part);
  }
  if (unique.length < 2 || unique.length > 5) return null;
  return unique;
}

/**
 * Parse a note such as "dinner and a movie Friday at 7".
 * Returns null when the note is not a 2–5 step plan with a weekday and a time.
 * `now` decides tonight/tomorrow only. The server resolves the calendar date.
 */
export function parseDateNight(text: string, now: Date = new Date(), timeZone = 'America/Chicago'): DateNightPlan | null {
  const source = plain(text, MAX_INPUT);
  if (!source) return null;
  const dayMatch = WEEKDAY_PATTERN.exec(source);
  const timeMatch = TIME_PATTERN.exec(source);
  if (!dayMatch || !timeMatch || timeMatch.index === undefined) return null;
  const clock = hourOnClock(Number(timeMatch[1]), timeMatch[2] ? Number(timeMatch[2]) : 0, timeMatch[3]);
  if (!clock) return null;

  const word = dayMatch[1].toLowerCase();
  const todayDow = isoDow(now, timeZone);
  let weekday: number;
  if (word === 'tonight') weekday = todayDow;
  else if (word === 'tomorrow') weekday = todayDow === 7 ? 1 : todayDow + 1;
  else weekday = WEEKDAY_NAMES.indexOf(word as (typeof WEEKDAY_NAMES)[number]) + 1;
  if (weekday < 1 || weekday > 7) return null;

  const stripped = source
    .replace(WEEKDAY_PATTERN, ' ')
    .replace(/\b(on|this)\b/gi, ' ')
    .replace(TIME_PATTERN, ' ');
  const phrase = plain(stripped, 120);
  const steps = dateNightSteps(phrase);
  if (!steps) return null;
  const title = capitalize(phrase);
  if (!title) return null;
  return { title, steps, due: { weekday, hour: clock.hour, minute: clock.minute } };
}

/** Accept only the three plan fields. Extra keys and out-of-range values are dropped. */
export function sanitizeDateNight(value: unknown): DateNightPlan | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const allowed = new Set(['title', 'steps', 'due']);
  for (const key of Object.keys(row)) {
    if (!allowed.has(key)) return null;
  }
  if (!row.due || typeof row.due !== 'object' || Array.isArray(row.due)) return null;
  const due = row.due as Record<string, unknown>;
  for (const key of Object.keys(due)) {
    if (key !== 'weekday' && key !== 'hour' && key !== 'minute') return null;
  }
  const title = typeof row.title === 'string' ? plain(row.title, 120) : '';
  const steps = Array.isArray(row.steps)
    ? row.steps.map((step) => (typeof step === 'string' ? capitalize(plain(step, 120)) : '')).filter((step) => step.length > 0)
    : [];
  const weekday = due.weekday;
  const hour = due.hour;
  const minute = due.minute;
  if (!title || steps.length < 2 || steps.length > 5) return null;
  if (typeof weekday !== 'number' || typeof hour !== 'number' || typeof minute !== 'number') return null;
  if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) return null;
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null;
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) return null;
  return { title, steps, due: { weekday, hour, minute } };
}
