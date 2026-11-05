/**
 * Weekly autopilot and the Pharmacy weekly pack.
 * The server owns creation and dedupe (apply_pharmacy_weekly_pack). This module
 * only shares the titles the board shows and the "already due" filter Home and
 * Quests use before ensure_quest_instance. No personal health records.
 */

export const PHARMACY_WEEKLY_DOMAIN = 'career';
/** ISO weekday: 1 = Monday. */
export const PHARMACY_WEEKLY_WEEKDAY = 1;

export const PHARMACY_WEEKLY_TITLES = [
  'Tech schedule',
  'Pharmacist schedule',
  'Supplies order',
  'U Learn check',
  'Attendance check',
  'PTO check',
] as const;

export const ISO_WEEKDAYS = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 7, label: 'Sunday' },
] as const;

export function weekdayLabel(weekday: number | null | undefined): string | null {
  return ISO_WEEKDAYS.find((day) => day.value === weekday)?.label ?? null;
}

/** Active non-goal quests whose start date is today or earlier. Goals stay caller-owned. */
export function questsDueForInstance<T extends { quest_type?: string | null; scheduled_for?: string | null }>(
  quests: readonly T[],
  today: string,
): T[] {
  return quests.filter((quest) => quest.quest_type !== 'goal' && (!quest.scheduled_for || quest.scheduled_for <= today));
}
