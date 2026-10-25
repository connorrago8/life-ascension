import { isQuestDomain, type QuestDomain } from './domains';

/**
 * Starter quests for Day 1.
 *
 * Cadence is only `daily` or `once`. The quests table and create_scheduled_quest
 * reject anything else (migrations 0001, 0003, and 0007). Weekly and monthly
 * are not offered because those values are not stored or accepted.
 *
 * `focus` is the quest domain written by the existing create RPC. Descriptions
 * are shown on the suggestion card only. The quests table has no description column.
 */
export type QuestCadence = 'once' | 'daily';

export type QuestTemplate = {
  id: string;
  title: string;
  description: string;
  cadence: QuestCadence;
  focus: QuestDomain;
};

export const QUEST_TEMPLATES: readonly QuestTemplate[] = [
  {
    id: 'walk-10',
    title: 'Take a 10-minute walk',
    description: 'Walk outside for ten minutes.',
    cadence: 'daily',
    focus: 'physical_health',
  },
  {
    id: 'squats-10',
    title: 'Do ten bodyweight squats',
    description: 'Do ten slow squats wherever you are.',
    cadence: 'daily',
    focus: 'physical_health',
  },
  {
    id: 'stretch-5',
    title: 'Stretch for five minutes',
    description: 'Stretch your neck, back, and legs.',
    cadence: 'once',
    focus: 'physical_health',
  },
  {
    id: 'make-bed',
    title: 'Make your bed',
    description: 'Straighten the sheets before you leave the room.',
    cadence: 'daily',
    focus: 'home',
  },
  {
    id: 'clear-surface',
    title: 'Clear one surface in your home',
    description: 'Clear one table, counter, or desk.',
    cadence: 'once',
    focus: 'home',
  },
  {
    id: 'wash-dishes',
    title: "Wash today's dishes",
    description: 'Wash the dishes that are in the sink today.',
    cadence: 'daily',
    focus: 'home',
  },
  {
    id: 'read-10',
    title: 'Read for ten minutes',
    description: 'Read a few pages of something you chose.',
    cadence: 'daily',
    focus: 'personal_growth',
  },
  {
    id: 'learn-note',
    title: 'Write down one thing you want to learn',
    description: 'Write one skill or topic you want to learn.',
    cadence: 'once',
    focus: 'personal_growth',
  },
  {
    id: 'track-spending',
    title: 'Write down what you spent today',
    description: 'List the money you spent today.',
    cadence: 'daily',
    focus: 'finance',
  },
  {
    id: 'check-balance',
    title: 'Check one account balance',
    description: 'Open one account and note the balance.',
    cadence: 'once',
    focus: 'finance',
  },
  {
    id: 'slow-breath',
    title: 'Take three slow breaths',
    description: 'Pause and breathe slowly three times.',
    cadence: 'daily',
    focus: 'mental_health',
  },
  {
    id: 'check-in',
    title: 'Send a short message to someone you care about',
    description: 'Send one genuine message to someone you care about.',
    cadence: 'once',
    focus: 'relationships',
  },
  {
    id: 'brush-teeth',
    title: 'Brush your teeth tonight',
    description: 'Brush for two minutes before bed.',
    cadence: 'daily',
    focus: 'hygiene',
  },
  {
    id: 'top-task',
    title: "Write tomorrow's top task",
    description: 'Write the one work task you will do first tomorrow.',
    cadence: 'once',
    focus: 'career',
  },
];

export const PREVIEW_FOCUS: readonly QuestDomain[] = ['physical_health', 'home', 'personal_growth'];

/**
 * Pick exactly three templates. Order follows the focus list, round-robin,
 * so each chosen area is represented before a second quest from the same area.
 * If a focus has fewer than three templates, the rest are filled from the
 * catalog in declaration order. The same focus list always returns the same three.
 */
export function selectSuggestedQuests(
  focus: readonly string[],
  templates: readonly QuestTemplate[] = QUEST_TEMPLATES,
): QuestTemplate[] {
  const chosenFocus: QuestDomain[] = [];
  for (const id of focus) {
    if (!isQuestDomain(id) || chosenFocus.includes(id)) continue;
    chosenFocus.push(id);
    if (chosenFocus.length === 3) break;
  }

  const picked: QuestTemplate[] = [];
  const used = new Set<string>();
  if (chosenFocus.length > 0) {
    const buckets = chosenFocus.map((domain) => templates.filter((template) => template.focus === domain));
    let added = true;
    while (picked.length < 3 && added) {
      added = false;
      for (const bucket of buckets) {
        const next = bucket.find((template) => !used.has(template.id));
        if (!next) continue;
        used.add(next.id);
        picked.push(next);
        added = true;
        if (picked.length === 3) break;
      }
    }
  }

  for (const template of templates) {
    if (picked.length >= 3) break;
    if (used.has(template.id)) continue;
    used.add(template.id);
    picked.push(template);
  }

  return picked.slice(0, 3);
}
