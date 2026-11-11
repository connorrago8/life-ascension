import { CARDS, MAX_DECK_SIZE, STARTER_DECK, type CardId } from './cards.ts';

/**
 * Starter decks chosen at the start of a run (existing cards only, no stat changes).
 * Tuned with scripts/simulate-crypt-delve.mjs so all four clear Floor 1 at a similar
 * rate (L1 balanced ~22–25%, L3 balanced ~65–70% over 1,000 sim runs each).
 * The opening 1-of-2 card pick still follows, so a run starts with 11 cards.
 */
export type StarterId = 'bruiser' | 'duelist' | 'scholar' | 'guardian';

export type StarterDeck = { id: StarterId; name: string; line: string; cards: readonly CardId[] };

export const STARTER_DECKS: readonly StarterDeck[] = [
  {
    id: 'bruiser', name: 'Bruiser', line: 'Big physical hits: Expose with Bash, build Might, make them bleed.',
    cards: ['strike', 'strike', 'rend', 'guard', 'guard', 'guard', 'bash', 'battle-cry', 'focus', 'cleaver'],
  },
  {
    id: 'duelist', name: 'Duelist', line: 'Quick, cheap plays that chain into Momentum and counters.',
    cards: ['strike', 'strike', 'strike', 'guard', 'guard', 'guard', 'guard', 'quick-jab', 'momentum', 'riposte'],
  },
  {
    id: 'scholar', name: 'Scholar', line: 'Spells and statuses: Hex to weaken, Kindle to burn, Arcane Bolt to finish.',
    cards: ['spark', 'strike', 'strike', 'guard', 'guard', 'guard', 'guard', 'arcane-bolt', 'hex', 'kindle'],
  },
  {
    id: 'guardian', name: 'Guardian', line: 'Stack Block, keep it with Entrench, then Body Slam with it.',
    cards: ['strike', 'strike', 'strike', 'guard', 'guard', 'iron-skin', 'iron-skin', 'body-slam', 'shield-bash', 'entrench'],
  },
];

export const STARTER_IDS: readonly StarterId[] = STARTER_DECKS.map((deck) => deck.id);

export function starterById(id: string | null | undefined): StarterDeck | null {
  return STARTER_DECKS.find((deck) => deck.id === id) ?? null;
}

/** The deck a run starts with. No (or an unknown) choice falls back to the default starting deck. */
export function starterCards(id: string | null | undefined): CardId[] {
  return (starterById(id)?.cards ?? STARTER_DECK).slice();
}

/** Sorted "Strike ×3, Guard ×4, …" summary for the deck-select screen. */
export function starterSummary(cards: readonly CardId[]): { id: CardId; name: string; count: number }[] {
  const counts = new Map<CardId, number>();
  for (const id of cards) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts.entries()]
    .map(([id, count]) => ({ id, name: CARDS[id].name, count }))
    .sort((a, b) => CARDS[a.id].cost - CARDS[b.id].cost || a.name.localeCompare(b.name));
}

export const STARTER_DECK_LIMITS = { min: 10, max: MAX_DECK_SIZE } as const;
