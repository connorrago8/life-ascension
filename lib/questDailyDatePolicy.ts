/**
 * A12 design-only date-policy probe. NOT called by any RPC or application route.
 * The live SQL completion RPC still uses America/Chicago; no server-side player
 * timezone or creation-date guard is deployed by this module.
 *
 * Legacy compatibility remains the default until CEO approves a migration
 * plan covering both legacy and v2 completion RPCs.
 */
export type DailyDateDecision =
  | 'eligible'
  | 'future'
  | 'before_schedule'
  | 'outside_two_day_window'
  | 'before_creation';

export type DailyDatePolicy = 'legacy_two_day' | 'creation_date_guard';

function parseDate(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new RangeError('Invalid calendar date');
  const [year, month, day] = value.split('-').map(Number);
  const ordinal = Date.UTC(year, month - 1, day) / 86_400_000;
  if (new Date(ordinal * 86_400_000).toISOString().slice(0, 10) !== value) {
    throw new RangeError('Invalid calendar date');
  }
  return ordinal;
}

/** Explicit IANA zone is required; never trust a client-provided zone for XP. */
export function dateInTimeZone(instant: string, timeZone: string): string {
  const date = new Date(instant);
  if (!Number.isFinite(date.getTime())) throw new RangeError('Invalid timestamp');
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const part = (type: string) => parts.find(p => p.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function evaluateDailyDatePolicy(input: {
  now: string;
  timeZone: string;
  dueDate: string;
  scheduledFor: string;
  createdAt: string;
  policy?: DailyDatePolicy;
}): DailyDateDecision {
  const today = parseDate(dateInTimeZone(input.now, input.timeZone));
  const due = parseDate(input.dueDate);
  const scheduled = parseDate(input.scheduledFor);
  if (due > today) return 'future';
  if (due < scheduled) return 'before_schedule';
  if (due < today - 2) return 'outside_two_day_window';
  if (input.policy === 'creation_date_guard') {
    const created = parseDate(dateInTimeZone(input.createdAt, input.timeZone));
    if (due < created) return 'before_creation';
  }
  return 'eligible';
}
