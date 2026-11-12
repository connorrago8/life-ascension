/**
 * Pharmacy weekly pack. The database creates the six Monday quests and skips a
 * title the player already has (`apply_pharmacy_weekly_pack`). This module only
 * shares those work-task titles with the board. No patient information.
 */

export const PHARMACY_WEEKLY_DOMAIN = 'career';
/** ISO weekday: 1 = Monday … 7 = Sunday. */
export const PHARMACY_WEEKLY_WEEKDAY = 1;

export const PHARMACY_WEEKLY_TITLES = [
  'Tech schedule',
  'Pharmacist schedule',
  'Supplies order',
  'U Learn check',
  'Attendance check',
  'PTO check',
] as const;

/** Board copy for the six pack titles. The database stores the same sentences. */
export const PHARMACY_WEEKLY_DESCRIPTIONS: Record<(typeof PHARMACY_WEEKLY_TITLES)[number], string> = {
  'Tech schedule': "Set the crew's week in motion with a clear, fair plan.",
  'Pharmacist schedule': 'Keep the watch covered and every shift accounted for.',
  'Supplies order': 'Restock the essentials before the shelves run thin.',
  'U Learn check': 'Clear the training ledger and keep your skills sharp.',
  'Attendance check': "Review the week's coverage and catch gaps early.",
  'PTO check': 'Mark upcoming absences so the team can plan ahead.',
};

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

/** Trim, collapse whitespace, lowercase. Same rule as public.quest_title_key. */
export function questTitleKey(title: string): string {
  return title.trim().replace(/\s+/g, ' ').toLowerCase();
}
