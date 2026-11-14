/** Starter couple-quest pack. Flavor lines are pack v2 section 7.
 * Cadence is weekly or monthly. Connor's award ignores any proposed base XP.
 * Izzy's amount is a server config, default 10, paid once. */

export type CoupleCadence = 'weekly' | 'monthly';

export type CoupleQuestTemplate = {
  title: string;
  description: string;
  cadence: CoupleCadence;
};

export const COUPLE_QUEST_PACK: readonly CoupleQuestTemplate[] = [
  { title: 'Evening wind-down', description: 'Put the day down together before sleep.', cadence: 'weekly' },
  { title: 'A walk without phones', description: 'Leave the noise behind and rediscover the art of talking.', cadence: 'weekly' },
  { title: 'Coffee date', description: 'Share a warm drink and an unhurried hour.', cadence: 'weekly' },
  { title: 'Plan our next adventure', description: 'Put a new pin on the map of your shared story.', cadence: 'weekly' },
  { title: 'One thoughtful surprise', description: 'Make an ordinary day unexpectedly bright.', cadence: 'weekly' },
  { title: 'Game night', description: 'Trade the day\'s demands for a little friendly competition.', cadence: 'weekly' },
  { title: 'Sunday reset', description: 'Restore your shared space before the next chapter begins.', cadence: 'weekly' },
  { title: 'Try something new', description: 'Step outside the familiar and bring home a new memory.', cadence: 'monthly' },
  { title: 'At-home movie night', description: 'Dim the lights and disappear into a story together.', cadence: 'weekly' },
  { title: 'Make a shared playlist', description: 'Build a soundtrack only the two of you fully understand.', cadence: 'monthly' },
  { title: 'Memory lane', description: 'Revisit the moments that brought you here.', cadence: 'monthly' },
  { title: 'Workout together', description: 'Move side by side, at your own pace.', cadence: 'weekly' },
  { title: 'A real check-in', description: 'Make room for the things that matter but rarely get said.', cadence: 'weekly' },
  { title: 'Call someone we love', description: 'Keep a connection strong beyond your own front door.', cadence: 'weekly' },
  { title: 'Our next chapter', description: 'Choose one shared goal and take its first small step.', cadence: 'monthly' },
];

export function coupleTitleKey(title: string): string {
  return title.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Titles already on the bond are left alone. Comparison is the normalized title. */
export function packTitlesToAdd(existingTitles: readonly string[]): CoupleQuestTemplate[] {
  const have = new Set(existingTitles.map(coupleTitleKey));
  return COUPLE_QUEST_PACK.filter((quest) => !have.has(coupleTitleKey(quest.title)));
}
