export const WELLNESS_EMPTY = 'Not connected yet';

export type WellnessSnapshot =
  | { connected: false }
  | { connected: true; sleepHours: number | null; steps: number | null };

function reading(row: Record<string, unknown>, key: string): number | null {
  const value = row[key];
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value;
  return null;
}

/**
 * Wellness only renders numbers that are already on the profile.
 * There is no sleep or step source in this app, so a normal profile stays disconnected.
 */
export function wellnessSnapshot(row: Record<string, unknown> | null | undefined): WellnessSnapshot {
  if (!row) return { connected: false };
  const sleepHours = reading(row, 'sleep_hours');
  const steps = reading(row, 'steps');
  if (sleepHours == null && steps == null) return { connected: false };
  return { connected: true, sleepHours, steps };
}
