/** Life domains stored on quests. Values match the quests.domain check and create_scheduled_quest. */
export const QUEST_DOMAINS = [
  'hygiene',
  'home',
  'mental_health',
  'personal_growth',
  'finance',
  'career',
  'relationships',
  'physical_health',
] as const;

export type QuestDomain = (typeof QUEST_DOMAINS)[number];

/** Labels used by the quest board and the create form. */
export const DOMAINS: readonly (readonly [QuestDomain, string])[] = [
  ['hygiene', 'Hygiene & appearance'],
  ['home', 'Home & environment'],
  ['mental_health', 'Mental health & recovery'],
  ['personal_growth', 'Growth & hobbies'],
  ['finance', 'Financial health'],
  ['career', 'Career & productivity'],
  ['relationships', 'Relationships'],
  ['physical_health', 'Physical health'],
];

/** Short chip labels for Day 1 focus. Each id is a real quest domain. */
export const FOCUS_AREAS: readonly { id: QuestDomain; label: string }[] = [
  { id: 'physical_health', label: 'Fitness' },
  { id: 'home', label: 'Home' },
  { id: 'personal_growth', label: 'Learning' },
  { id: 'finance', label: 'Finances' },
  { id: 'mental_health', label: 'Health' },
  { id: 'relationships', label: 'Relationships' },
  { id: 'hygiene', label: 'Hygiene' },
  { id: 'career', label: 'Career' },
];

export function isQuestDomain(value: string): value is QuestDomain {
  return (QUEST_DOMAINS as readonly string[]).includes(value);
}

export function domainLabel(domain: string): string {
  return DOMAINS.find((entry) => entry[0] === domain)?.[1] ?? domain;
}

export function focusLabel(domain: string): string {
  return FOCUS_AREAS.find((entry) => entry.id === domain)?.label ?? domainLabel(domain);
}
