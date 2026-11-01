/** The player's calendar day. America/Chicago is only the fallback. */
export const FALLBACK_TIME_ZONE = 'America/Chicago';

export function isValidTimeZone(timeZone: string): boolean {
  if (!timeZone || timeZone.length > 80) return false;
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

/** Device zone when it is a real IANA name, otherwise America/Chicago. */
export function playerTimeZone(resolved?: string | null): string {
  const zone = resolved ?? (typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : '');
  return zone && isValidTimeZone(zone) ? zone : FALLBACK_TIME_ZONE;
}

/** Local calendar date YYYY-MM-DD in `timeZone`. */
export function localToday(now: Date = new Date(), timeZone: string = playerTimeZone()): string {
  const zone = isValidTimeZone(timeZone) ? timeZone : FALLBACK_TIME_ZONE;
  return new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
