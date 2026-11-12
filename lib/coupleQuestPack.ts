/** Starter couple-quest pack from the content design pack, section 3.
 * Cadence is weekly or monthly. Connor's award ignores any proposed base XP
 * and uses the personal streak formula. Izzy's amount is a server config. */

export type CoupleCadence = 'weekly' | 'monthly';

export type CoupleQuestTemplate = {
  title: string;
  description: string;
  cadence: CoupleCadence;
};

export const COUPLE_QUEST_PACK: readonly CoupleQuestTemplate[] = [
  { title: 'Cook dinner together', description: 'Make a meal as a team, from preparation to cleanup.', cadence: 'weekly' },
  { title: 'A walk without phones', description: 'Spend at least 20 minutes walking and talking without scrolling.', cadence: 'weekly' },
  { title: 'Coffee date', description: 'Get coffee together and enjoy an uninterrupted conversation.', cadence: 'weekly' },
  { title: 'Plan our next adventure', description: 'Choose one outing, date, or experience to look forward to.', cadence: 'weekly' },
  { title: 'One thoughtful surprise', description: 'Do something small and unexpected for each other.', cadence: 'weekly' },
  { title: 'Game night', description: 'Play a board game, video game, or card game together.', cadence: 'weekly' },
  { title: 'Sunday reset', description: 'Spend 30 minutes getting your shared space ready for the week.', cadence: 'weekly' },
  { title: 'Try something new', description: 'Visit somewhere new or try an activity neither of you has done together.', cadence: 'monthly' },
  { title: 'At-home movie night', description: 'Choose a movie, prepare snacks, and watch it together.', cadence: 'weekly' },
  { title: 'Make a shared playlist', description: 'Pick songs that remind you of each other or a shared memory.', cadence: 'monthly' },
  { title: 'Memory lane', description: 'Look through old photos and share favorite memories.', cadence: 'monthly' },
  { title: 'Workout together', description: 'Complete a walk, gym session, yoga class, or workout as a pair.', cadence: 'weekly' },
  { title: 'A real check-in', description: 'Talk about what went well this week and what support would help.', cadence: 'weekly' },
  { title: 'Call someone we love', description: 'Together, reach out to a family member or friend.', cadence: 'weekly' },
  { title: 'Our next chapter', description: 'Write down one shared goal and the next small step toward it.', cadence: 'monthly' },
];

export function coupleTitleKey(title: string): string {
  return title.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Titles already on the bond are left alone. Comparison is the normalized title. */
export function packTitlesToAdd(existingTitles: readonly string[]): CoupleQuestTemplate[] {
  const have = new Set(existingTitles.map(coupleTitleKey));
  return COUPLE_QUEST_PACK.filter((quest) => !have.has(coupleTitleKey(quest.title)));
}
