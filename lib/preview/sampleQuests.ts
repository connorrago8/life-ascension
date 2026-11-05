/** Sample quests for the home preview. Local view state only. */

export type SampleQuest = {
  id: string;
  title: string;
  detail: string;
  area: string;
  /** Sample amount the completion flourish displays. It is not a saved reward. */
  xp: number;
};

export const MEAL_QUEST_ID = 'meals';
export const MEAL_KEYS = ['breakfast', 'lunch', 'dinner'] as const;
export type MealKey = (typeof MEAL_KEYS)[number];

export const SAMPLE_QUESTS: readonly SampleQuest[] = [
  {
    id: MEAL_QUEST_ID,
    title: 'Fuel the Adventurer',
    detail: 'Log breakfast, lunch, and dinner. Nutrition imports can be added later.',
    area: 'Nutrition',
    xp: 40,
  },
  {
    id: 'workout',
    title: 'Work out 30 min',
    detail: 'Move with intent for 30 minutes. A walk counts.',
    area: 'Physical health',
    xp: 40,
  },
  {
    id: 'water',
    title: 'Drink 8 glasses of water',
    detail: 'Eight glasses, spread through the day.',
    area: 'Physical health',
    xp: 25,
  },
  {
    id: 'read',
    title: 'Read 20 pages',
    detail: 'Twenty pages of anything you meant to finish.',
    area: 'Growth',
    xp: 160,
  },
  {
    id: 'budget',
    title: 'Review budget 10 min',
    detail: 'Ten quiet minutes with the budget.',
    area: 'Financial health',
    xp: 20,
  },
  {
    id: 'bed',
    title: 'In bed by 11 PM',
    detail: 'Lights out by 11. The day can end.',
    area: 'Recovery',
    xp: 320,
  },
];

/** The number the completion flourish shows. It does not change progression. */
export function displayedQuestXp(quest: { xp: number }): number {
  return quest.xp;
}

export const SAMPLE_NOTIFICATION_COUNT = 1;
