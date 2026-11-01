import { cardDef, isUpgraded, MAX_DECK_SIZE, type CardId, type DeckCard } from './cards.ts';

/**
 * Pile and deck summaries for the UI. Display only: nothing here changes a run.
 * Lists are always grouped and sorted by cost, then name, then upgraded last, so the
 * draw pile can be inspected without ever revealing the order cards will be drawn in.
 */
export type PileEntry = { key: DeckCard; name: string; cost: number; text: string; upgraded: boolean; count: number };

export function pileSummary(cards: readonly (DeckCard | { id: DeckCard })[]): PileEntry[] {
  const counts = new Map<DeckCard, number>();
  for (const card of cards) {
    const key = typeof card === 'string' ? card : card.id;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const entries = [...counts.entries()].map(([key, count]) => {
    const def = cardDef(key);
    const upgraded = isUpgraded(key);
    return { key, name: def.name, cost: def.cost, text: def.text, upgraded, count };
  });
  return entries.sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name) || Number(a.upgraded) - Number(b.upgraded));
}

/** Copies of a card already in the deck, upgraded copies included. */
export function copiesInDeck(deck: readonly DeckCard[], id: CardId): number {
  return deck.filter((key) => cardDef(key).id === id).length;
}

export function deckIsFull(deck: readonly DeckCard[]): boolean {
  return deck.length >= MAX_DECK_SIZE;
}
