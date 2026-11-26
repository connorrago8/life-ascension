import { weekStart } from '../questStreak.ts';
import { PAYDAY_TITLE } from './config.ts';
import { shiftDate } from './dates.ts';

/**
 * Health follow-ups stay locked until this many completed game weeks in a row
 * each have the lights-out goal. A game week is Monday through Sunday at the
 * 5 AM boundary. The week that contains today has not finished, so it does not
 * count. Change the numbers here; the SQL function uses the same three values.
 */
export const HEALTH_FOLLOW_UP_UNLOCK = {
  nightsRequired: 6,
  nightsInWeek: 7,
  straightWeeks: 2,
} as const;

export const HEALTH_TEMPLATES = [
  { id: 'protein_meal', title: 'Pick a protein-rich meal' },
  { id: 'backup_meal', title: 'Choose an easy backup meal' },
  { id: 'pack_meal', title: 'Pack a meal before a close' },
  { id: 'add_produce', title: 'Add produce to a meal' },
  { id: 'grocery_list', title: 'Build a short grocery list' },
  { id: 'easy_walk', title: 'Take an easy walk' },
  { id: 'walking_route', title: 'Try a different walking route' },
  { id: 'movement_break', title: 'Take a movement break' },
  { id: 'movement_window', title: 'Schedule a movement window', detail: 'Credit when the session is done, not when it is scheduled.' },
  { id: 'repeat_session', title: 'Repeat a movement session that worked' },
] as const;

export const FINANCE_TEMPLATE_DETAIL = 'Do this in your private finance workflow, then mark it done.';

export const FINANCE_TEMPLATES = [
  { id: 'payday_check', title: PAYDAY_TITLE, detail: FINANCE_TEMPLATE_DETAIL },
  { id: 'pay_down_card', title: 'Pay Down a Card', detail: FINANCE_TEMPLATE_DETAIL },
  { id: 'cash_buffer', title: 'Check the Cash Buffer', detail: FINANCE_TEMPLATE_DETAIL },
  { id: 'upcoming_bills', title: 'Review Upcoming Bills', detail: FINANCE_TEMPLATE_DETAIL },
  { id: 'payment_posted', title: 'Confirm a Payment Posted', detail: FINANCE_TEMPLATE_DETAIL },
  { id: 'promo_deadline', title: 'Check a Promo Deadline', detail: FINANCE_TEMPLATE_DETAIL },
  { id: 'week_spending', title: "Review This Week's Spending", detail: FINANCE_TEMPLATE_DETAIL },
  { id: 'next_cycle', title: 'Choose My Next Pay Cycle Action', detail: FINANCE_TEMPLATE_DETAIL },
  { id: 'close_month', title: 'Close the Month', detail: FINANCE_TEMPLATE_DETAIL },
  { id: 'backup_plan', title: 'Revisit My Backup Plan', detail: FINANCE_TEMPLATE_DETAIL },
] as const;

export type TrackId = 'health' | 'finance';
export type TemplateStatus = 'locked' | 'due' | 'in_progress' | 'complete' | 'skipped';
export type StoredStatus = 'in_progress' | 'complete' | 'skipped';

export const TEMPLATE_LABEL: Record<TemplateStatus, string> = {
  locked: 'Unlocks later',
  due: 'Due',
  in_progress: 'In progress',
  complete: 'Complete',
  skipped: 'Skipped',
};

export type TemplateDef = { id: string; title: string; detail?: string };
export type TemplateState = { id: string; status: StoredStatus };

const HEALTH_IDS = new Set<string>(HEALTH_TEMPLATES.map((item) => item.id));
const FINANCE_IDS = new Set<string>(FINANCE_TEMPLATES.map((item) => item.id));

export function templatesFor(track: TrackId): readonly TemplateDef[] {
  return track === 'health' ? HEALTH_TEMPLATES : FINANCE_TEMPLATES;
}

export function allTrackTemplates(): TemplateDef[] {
  return [...HEALTH_TEMPLATES, ...FINANCE_TEMPLATES];
}

export function isTemplateId(track: TrackId, id: string): boolean {
  return (track === 'health' ? HEALTH_IDS : FINANCE_IDS).has(id);
}

function nightsInWeek(recorded: ReadonlySet<string>, monday: string, length: number): number {
  let count = 0;
  for (let offset = 0; offset < length; offset += 1) {
    if (recorded.has(shiftDate(monday, offset))) count += 1;
  }
  return count;
}

/** True when the last `straightWeeks` finished game weeks each met the lights-out goal. */
export function healthFollowUpsUnlocked(
  recorded: readonly string[],
  today: string,
  rule = HEALTH_FOLLOW_UP_UNLOCK,
): boolean {
  const days = new Set(recorded);
  const thisWeek = weekStart(today);
  for (let index = 1; index <= rule.straightWeeks; index += 1) {
    const monday = shiftDate(thisWeek, -7 * index);
    if (nightsInWeek(days, monday, rule.nightsInWeek) < rule.nightsRequired) return false;
  }
  return true;
}

export function templateStatus(
  track: TrackId,
  id: string,
  states: readonly TemplateState[],
  unlocked: boolean,
): TemplateStatus {
  const stored = states.find((state) => state.id === id)?.status;
  if (stored) return stored;
  if (track === 'health' && !unlocked) return 'locked';
  return 'due';
}

/** One health follow-up may be in progress. Finance templates are independent. Payday stays on its own check. */
export function canStartTemplate(
  track: TrackId,
  id: string,
  states: readonly TemplateState[],
  unlocked: boolean,
): boolean {
  if (id === 'payday_check') return false;
  if (!isTemplateId(track, id)) return false;
  if (templateStatus(track, id, states, unlocked) !== 'due') return false;
  if (track === 'health' && !unlocked) return false;
  if (track === 'health' && states.some((state) => state.status === 'in_progress')) return false;
  return true;
}

export function canFinishTemplate(track: TrackId, id: string, states: readonly TemplateState[], unlocked: boolean): boolean {
  return templateStatus(track, id, states, unlocked) === 'in_progress';
}

/** A second finish does not pay. Only an in-progress template pays, and it pays once. */
export function finishPaysOnce(status: TemplateStatus): { pay: boolean; already: boolean } {
  if (status === 'complete') return { pay: false, already: true };
  if (status === 'in_progress') return { pay: true, already: false };
  return { pay: false, already: false };
}
