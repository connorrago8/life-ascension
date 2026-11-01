/**
 * Tap-to-open quest cards. A tap anywhere on the card body opens the quest's
 * existing detail route (/quests/[id]); taps on the card's own controls
 * (Complete, Defer, progress inputs, details disclosure, links) keep their
 * normal behavior. Keyboard users reach the same route via the title link.
 */
export const QUEST_CARD_INTERACTIVE_SELECTOR =
  'a, button, input, select, textarea, label, summary, details, [role="button"], [contenteditable="true"]';

export function questDetailHref(questId: string): string {
  return `/quests/${encodeURIComponent(questId)}`;
}

type ClosestTarget = { closest?: (selector: string) => unknown } | null | undefined;

/** True when a card tap should open details instead of a nested control. */
export function shouldOpenQuestCard(target: ClosestTarget, selectionText = ''): boolean {
  if (selectionText.trim()) return false; // the user was selecting text, not tapping
  if (!target || typeof target.closest !== 'function') return false;
  return !target.closest(QUEST_CARD_INTERACTIVE_SELECTOR);
}
