/** Izzy's 60 activity examples. One match, one award. Uncertain text takes the lower tier. */

export type GuideTier = 'small' | 'medium' | 'big';

export type ActivityExample = {
  n: number;
  title: string;
  tier: GuideTier;
  hint: string;
  tokens: readonly string[];
};

const SMALL = 'A quick, completed action.';
const MEDIUM = 'A meaningful full task or session.';
const BIG = 'A substantial multi-step effort.';

export const ACTIVITY_EXAMPLES: readonly ActivityExample[] = [
  { n: 1, title: 'Make the bed', tier: 'small', hint: SMALL, tokens: ['make', 'bed'] },
  { n: 2, title: 'Water plants', tier: 'small', hint: SMALL, tokens: ['water', 'plants'] },
  { n: 3, title: 'Take out trash', tier: 'small', hint: SMALL, tokens: ['trash'] },
  { n: 4, title: 'Wipe counters', tier: 'small', hint: SMALL, tokens: ['wipe', 'counters'] },
  { n: 5, title: 'Put away dishes', tier: 'small', hint: SMALL, tokens: ['put', 'dishes'] },
  { n: 6, title: 'Fold a small laundry load', tier: 'small', hint: SMALL, tokens: ['fold', 'laundry'] },
  { n: 7, title: 'Sort mail', tier: 'small', hint: SMALL, tokens: ['sort', 'mail'] },
  { n: 8, title: 'Tidy nightstand', tier: 'small', hint: SMALL, tokens: ['tidy', 'nightstand'] },
  { n: 9, title: "Pack tomorrow's bag", tier: 'small', hint: SMALL, tokens: ['pack', 'bag'] },
  { n: 10, title: 'Refill water bottle', tier: 'small', hint: SMALL, tokens: ['refill', 'bottle'] },
  { n: 11, title: 'Stretch for five minutes', tier: 'small', hint: SMALL, tokens: ['stretch', 'five'] },
  { n: 12, title: 'Take a short walk', tier: 'small', hint: SMALL, tokens: ['short', 'walk'] },
  { n: 13, title: 'Read ten minutes', tier: 'small', hint: SMALL, tokens: ['read', 'ten'] },
  { n: 14, title: 'Write a journal entry', tier: 'small', hint: SMALL, tokens: ['journal'] },
  { n: 15, title: 'Send a thoughtful message', tier: 'small', hint: SMALL, tokens: ['message'] },
  { n: 16, title: 'Clean a mirror', tier: 'small', hint: SMALL, tokens: ['clean', 'mirror'] },
  { n: 17, title: 'Sweep a small area', tier: 'small', hint: SMALL, tokens: ['sweep'] },
  { n: 18, title: 'Put away groceries', tier: 'small', hint: SMALL, tokens: ['put', 'groceries'] },
  { n: 19, title: 'Organize one shelf', tier: 'small', hint: SMALL, tokens: ['organize', 'shelf'] },
  { n: 20, title: 'Prepare a snack', tier: 'small', hint: SMALL, tokens: ['snack'] },
  { n: 21, title: 'Cook dinner', tier: 'medium', hint: MEDIUM, tokens: ['cook', 'dinner'] },
  { n: 22, title: 'Wash dishes and reset kitchen', tier: 'medium', hint: MEDIUM, tokens: ['wash', 'dishes'] },
  { n: 23, title: 'Complete laundry cycle', tier: 'medium', hint: MEDIUM, tokens: ['laundry', 'cycle'] },
  { n: 24, title: 'Clean kitchen', tier: 'medium', hint: MEDIUM, tokens: ['clean', 'kitchen'] },
  { n: 25, title: 'Vacuum living areas', tier: 'medium', hint: MEDIUM, tokens: ['vacuum'] },
  { n: 26, title: 'Walk thirty minutes', tier: 'medium', hint: MEDIUM, tokens: ['walk', 'thirty'] },
  { n: 27, title: 'Complete moderate workout', tier: 'medium', hint: MEDIUM, tokens: ['moderate', 'workout'] },
  { n: 28, title: 'Practice yoga thirty minutes', tier: 'medium', hint: MEDIUM, tokens: ['yoga', 'thirty'] },
  { n: 29, title: 'Study thirty minutes', tier: 'medium', hint: MEDIUM, tokens: ['study', 'thirty'] },
  { n: 30, title: 'Organize a cabinet', tier: 'medium', hint: MEDIUM, tokens: ['organize', 'cabinet'] },
  { n: 31, title: 'Plan meals', tier: 'medium', hint: MEDIUM, tokens: ['plan', 'meals'] },
  { n: 32, title: 'Shop for groceries', tier: 'medium', hint: MEDIUM, tokens: ['shop', 'groceries'] },
  { n: 33, title: 'Call family', tier: 'medium', hint: MEDIUM, tokens: ['call', 'family'] },
  { n: 34, title: 'Practice hobby thirty minutes', tier: 'medium', hint: MEDIUM, tokens: ['hobby', 'thirty'] },
  { n: 35, title: 'Reset bedroom', tier: 'medium', hint: MEDIUM, tokens: ['reset', 'bedroom'] },
  { n: 36, title: "Prepare tomorrow's lunch", tier: 'medium', hint: MEDIUM, tokens: ['lunch'] },
  { n: 37, title: 'Run a personal errand', tier: 'medium', hint: MEDIUM, tokens: ['errand'] },
  { n: 38, title: 'Review household budget', tier: 'medium', hint: MEDIUM, tokens: ['budget'] },
  { n: 39, title: 'Garden thirty minutes', tier: 'medium', hint: MEDIUM, tokens: ['garden', 'thirty'] },
  { n: 40, title: 'Plan a date', tier: 'medium', hint: MEDIUM, tokens: ['plan', 'date'] },
  { n: 41, title: 'Deep-clean bathroom', tier: 'big', hint: BIG, tokens: ['deep', 'clean', 'bathroom'] },
  { n: 42, title: 'Deep-clean kitchen', tier: 'big', hint: BIG, tokens: ['deep', 'clean', 'kitchen'] },
  { n: 43, title: 'Declutter a room', tier: 'big', hint: BIG, tokens: ['declutter'] },
  { n: 44, title: 'Complete demanding workout', tier: 'big', hint: BIG, tokens: ['demanding', 'workout'] },
  { n: 45, title: 'Take a long hike', tier: 'big', hint: BIG, tokens: ['long', 'hike'] },
  { n: 46, title: 'Finish a creative project', tier: 'big', hint: BIG, tokens: ['creative', 'project'] },
  { n: 47, title: 'Meal prep several days', tier: 'big', hint: BIG, tokens: ['meal', 'prep'] },
  { n: 48, title: 'Host dinner', tier: 'big', hint: BIG, tokens: ['host', 'dinner'] },
  { n: 49, title: 'Complete major home organization', tier: 'big', hint: BIG, tokens: ['major', 'organization'] },
  { n: 50, title: 'Volunteer for an afternoon', tier: 'big', hint: BIG, tokens: ['volunteer'] },
  { n: 51, title: 'Finish course module', tier: 'big', hint: BIG, tokens: ['course', 'module'] },
  { n: 52, title: 'Complete long cycling session', tier: 'big', hint: BIG, tokens: ['cycling'] },
  { n: 53, title: 'Attend important multi-step appointment', tier: 'big', hint: BIG, tokens: ['appointment'] },
  { n: 54, title: 'Complete household repair', tier: 'big', hint: BIG, tokens: ['repair'] },
  { n: 55, title: 'Work several hours on personal goal', tier: 'big', hint: BIG, tokens: ['personal', 'goal'] },
  { n: 56, title: 'Plan and take full-day outing', tier: 'big', hint: BIG, tokens: ['outing'] },
  { n: 57, title: 'Do seasonal cleanout', tier: 'big', hint: BIG, tokens: ['cleanout'] },
  { n: 58, title: 'Organize important records', tier: 'big', hint: BIG, tokens: ['records'] },
  { n: 59, title: 'Finish DIY project', tier: 'big', hint: BIG, tokens: ['diy'] },
  { n: 60, title: 'Complete sustained wellness workshop', tier: 'big', hint: BIG, tokens: ['workshop'] },
];

const NUMBER_WORDS: Record<string, string> = { '5': 'five', '10': 'ten', '30': 'thirty' };

const TIER_RANK: Record<GuideTier, number> = { small: 0, medium: 1, big: 2 };

/** Fold wording so "30-minute" and "cleaned" can meet the example tokens. */
export function foldActivity(text: string): string {
  return text.toLowerCase()
    .replace(/[’']/g, '')
    .replace(/-/g, ' ')
    .replace(/\b(\d+)\s*-?\s*(?:minutes?|min)\b/g, (_, n: string) => NUMBER_WORDS[n] ?? n)
    .replace(/\bmade\b/g, 'make')
    .replace(/\b(clean|cook|walk|fold|stretch|organiz|complet|finish|water|wipe|pack|sort|tidy|read|call|plan|host|shop)ed\b/g, '$1')
    .replace(/\b(clean|organiz|cook)ing\b/g, '$1')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function wordsOf(text: string): Set<string> {
  return new Set(foldActivity(text).split(' ').filter(Boolean));
}

export function matchingExamples(text: string): ActivityExample[] {
  const words = wordsOf(text);
  return ACTIVITY_EXAMPLES.filter((example) => example.tokens.every((token) => words.has(token)));
}

function lowest(examples: readonly ActivityExample[]): ActivityExample {
  return examples.reduce((best, example) => (TIER_RANK[example.tier] < TIER_RANK[best.tier] ? example : best));
}

/** One example wins. A longer token list wins only when every other hit is part of it. */
export function chooseExample(text: string): ActivityExample | null {
  const hits = matchingExamples(text);
  if (hits.length === 0) return null;
  const longest = Math.max(...hits.map((example) => example.tokens.length));
  const specific = hits.filter((example) => example.tokens.length === longest);
  const lead = specific[0];
  const covered = hits.every((example) => example.tokens.every((token) => lead.tokens.includes(token)));
  if (specific.length === 1 && covered) return lead;
  return lowest(hits);
}

export function examplesForTier(tier: GuideTier): readonly ActivityExample[] {
  return ACTIVITY_EXAMPLES.filter((example) => example.tier === tier);
}
