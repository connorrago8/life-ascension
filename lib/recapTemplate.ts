/** Sunday recap copy from Content & Design Pack v2, section 3.
 * Headlines are generic. Moments, quests, and unlocks are passed in and never invented here. */

export const RECAP_HEADLINES = [
  'Another chapter written.',
  'Small wins. Real progress.',
  'The week you kept showing up.',
  'Two paths, one adventure.',
  'A little stronger than last Sunday.',
  'Your story is taking shape.',
  'Progress looks good on you.',
  'Every moment left a mark.',
  'This week belongs in the story.',
  'Onward to the next chapter.',
] as const;

/** Proposal default. The week window and display time are not founder-signed. */
export const RECAP_SCHEDULE_PROPOSAL = 'sunday_chicago_5am_previous_7';

export type RecapFacts = {
  weekStart: string;
  weekEnd: string;
  connorXp: number;
  connorLevel: number;
  izzyXp: number;
  izzyLevel: number;
  coupleQuestsCompleted: number;
  bestMomentTitle: string | null;
  coupleQuestTitle: string | null;
  unlockNames: readonly string[];
  nextQuestTitle: string | null;
  seed: string;
};

function hash(seed: string): number {
  let value = 0;
  for (const char of seed) value = (Math.imul(value, 33) + char.charCodeAt(0)) >>> 0;
  return value;
}

function prettyDate(iso: string): string {
  const parsed = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export function recapHeadline(seed: string): string {
  return RECAP_HEADLINES[hash(seed) % RECAP_HEADLINES.length];
}

export function recapLines(facts: RecapFacts): string[] {
  const couple = Math.max(0, Math.floor(facts.coupleQuestsCompleted));
  const unlocks = facts.unlockNames.map((name) => name.trim()).filter((name) => name.length > 0);
  return [
    recapHeadline(facts.seed),
    `Your week in Life Ascension · ${prettyDate(facts.weekStart)}–${prettyDate(facts.weekEnd)}`,
    `Connor: +${Math.max(0, Math.floor(facts.connorXp))} XP · Level ${Math.max(1, Math.floor(facts.connorLevel))}`,
    `Izzy: +${Math.max(0, Math.floor(facts.izzyXp))} XP · Level ${Math.max(1, Math.floor(facts.izzyLevel))}`,
    `Together: ${couple} couple quest${couple === 1 ? '' : 's'} completed`,
    facts.bestMomentTitle
      ? `Moment worth remembering: ${facts.bestMomentTitle.replace(/\.+$/, '')}.`
      : 'Your next favorite moment is still ahead.',
    facts.coupleQuestTitle
      ? `Together this week: ${facts.coupleQuestTitle.replace(/\.+$/, '')}.`
      : 'No couple quest completed this week. Pick one small thing to do together.',
    unlocks.length > 0
      ? `New looks: ${unlocks.join(', ')}.`
      : 'No new gear this week. Every bit of XP still counts.',
    facts.nextQuestTitle
      ? `One idea for next week: ${facts.nextQuestTitle.replace(/\.+$/, '')}.`
      : 'Choose one small quest and make it yours.',
  ];
}
