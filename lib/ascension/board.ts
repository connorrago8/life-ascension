import { PHARMACY_WEEKLY_TITLES } from '../questAutopilot.ts';
import {
  FINANCE_FOLLOW_UPS,
  LIGHTS_OUT_TITLE,
  PAYDAY_TITLE,
  QUEST_CATEGORIES,
  type QuestCategoryId,
} from './config.ts';

const PHARMACY_TITLES = new Set<string>(PHARMACY_WEEKLY_TITLES);
const FINANCE_TITLES = new Set<string>([PAYDAY_TITLE, ...FINANCE_FOLLOW_UPS.map((item) => item.title)]);
const HEALTH_DOMAINS = new Set(['physical_health', 'mental_health', 'hygiene']);

export type BoardStatus = 'available' | 'completed' | 'deferred';

export type ClassifiedQuest = {
  id: string;
  title: string;
  domain: string;
  due: string | null;
  status: BoardStatus;
  instanceId: string | null;
  couple?: boolean;
};

export function questCategory(quest: { title: string; domain: string; couple?: boolean }): QuestCategoryId {
  if (quest.couple || quest.domain === 'relationships') return 'companionship';
  if (FINANCE_TITLES.has(quest.title) || quest.domain === 'finance') return 'finance';
  if (PHARMACY_TITLES.has(quest.title) || quest.domain === 'career') return 'pharmacy';
  if (quest.title === LIGHTS_OUT_TITLE || HEALTH_DOMAINS.has(quest.domain)) return 'health';
  return 'personal';
}

/** Lower sorts first: overdue, then due today, then later. Completed and deferred stay behind open rows. */
export function priorityRank(due: string | null, today: string, status: BoardStatus): number {
  if (status !== 'available') return 3;
  if (due && due < today) return 0;
  if (!due || due === today) return 1;
  return 2;
}

export function prioritizeQuests<T extends { due: string | null; status: BoardStatus; title: string }>(
  rows: readonly T[],
  today: string,
  limit: number | null,
): T[] {
  const sorted = [...rows].sort((a, b) => {
    const rank = priorityRank(a.due, today, a.status) - priorityRank(b.due, today, b.status);
    if (rank !== 0) return rank;
    const due = (a.due ?? '9999-99-99').localeCompare(b.due ?? '9999-99-99');
    if (due !== 0) return due;
    return a.title.localeCompare(b.title);
  });
  const open = sorted.filter((row) => row.status === 'available');
  const chosen = limit === null ? open : open.slice(0, limit);
  return chosen;
}

export function categoryHref(id: QuestCategoryId): string {
  return QUEST_CATEGORIES.find((category) => category.id === id)?.href ?? '/quests';
}
