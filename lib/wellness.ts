export const WELLNESS_EMPTY = 'Not connected yet';
/** In-app instructions for the Apple Health Shortcut. */
export const WELLNESS_HELP_HREF = '/settings/wellness';
/** Columns read from public.wellness_readings (RLS: your own rows only). */
export const WELLNESS_READING_COLUMNS = 'reading_date,sleep_hours,steps,source,updated_at';

export type WellnessSnapshot =
  | { connected: false }
  | { connected: true; date: string; sleepHours: number | null; steps: number | null };

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function reading(row: Record<string, unknown>, key: string): number | null {
  const raw = row[key];
  // PostgREST may serialize numeric as a string; accept only clean non-negative numbers.
  const value = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw;
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value;
  return null;
}

/**
 * Wellness renders only the latest real reading from public.wellness_readings
 * (posted by the Apple Health Shortcut through POST /api/wellness).
 * No reading, or a reading without numbers, stays "Not connected yet".
 */
export function wellnessSnapshot(rows: unknown): WellnessSnapshot {
  const list = Array.isArray(rows) ? rows : rows ? [rows] : [];
  let latest: WellnessSnapshot = { connected: false };
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;
    const date = typeof row.reading_date === 'string' && DATE_PATTERN.test(row.reading_date) ? row.reading_date : null;
    if (!date) continue;
    const sleepHours = reading(row, 'sleep_hours');
    const steps = reading(row, 'steps');
    if (sleepHours == null && steps == null) continue;
    if (!latest.connected || date > latest.date) latest = { connected: true, date, sleepHours, steps };
  }
  return latest;
}

/** 7.25 → "7 h 15 min"; 8 → "8 h". */
export function formatSleep(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export function formatSteps(steps: number): string {
  return Math.round(steps).toLocaleString('en-US');
}

/** "2026-10-30" → "Fri, Oct 30" (calendar date, no time zone shift). */
export function formatWellnessDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' });
}
