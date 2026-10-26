/** Sample quests for the home preview. Local view state only. */

export type SampleQuest = {
  id: string;
  title: string;
  detail: string;
  area: string;
};

export const SAMPLE_QUESTS: readonly SampleQuest[] = [
  {
    id: 'workout',
    title: 'Work out 30 min',
    detail: 'Move with intent for 30 minutes. A walk counts.',
    area: 'Physical health',
  },
  {
    id: 'water',
    title: 'Drink 8 glasses of water',
    detail: 'Eight glasses, spread through the day.',
    area: 'Physical health',
  },
  {
    id: 'read',
    title: 'Read 20 pages',
    detail: 'Twenty pages of anything you meant to finish.',
    area: 'Growth',
  },
  {
    id: 'budget',
    title: 'Review budget 10 min',
    detail: 'Ten quiet minutes with the budget.',
    area: 'Financial health',
  },
  {
    id: 'bed',
    title: 'In bed by 11 PM',
    detail: 'Lights out by 11. The day can end.',
    area: 'Recovery',
  },
];

export const SAMPLE_NOTIFICATION_COUNT = 1;
