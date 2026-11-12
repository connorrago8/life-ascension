/** Level-up screen and the 50 cosmetic reveal lines. Keyed by the existing cosmetic id. */

import { ADVENTURER_COSMETICS } from './adventurerCosmetics.ts';
import { PASS_TIERS } from './companionPass.ts';

const IZZY_REVEAL = 'From the midnight glow, a new piece of your legend emerges.';
const CONNOR_REVEAL = 'Another hard-earned relic joins your journey.';

export type CosmeticBearer = 'izzy' | 'connor';

/** Keys are `izzy:<id>` and `connor:<id>`. `cyber-visor` exists on both tracks. */
export const COSMETIC_REVEALS: Readonly<Record<string, string>> = Object.freeze({
  ...Object.fromEntries(PASS_TIERS.filter((item) => item.grantKind === 'level').map((item) => [`izzy:${item.id}`, IZZY_REVEAL])),
  ...Object.fromEntries(ADVENTURER_COSMETICS.map((item) => [`connor:${item.id}`, CONNOR_REVEAL])),
});

export function revealForCosmetic(who: CosmeticBearer, id: string): string | null {
  return COSMETIC_REVEALS[`${who}:${id}`] ?? null;
}

/** Next even level that can unlock gear. Null once level 50 is reached. */
export function nextEvenUnlock(level: number): number | null {
  if (level >= 50) return null;
  const next = level % 2 === 0 ? level + 2 : level + 1;
  return next <= 50 ? next : null;
}

export function levelUpLines(who: CosmeticBearer, level: number, item: { id: string; label: string } | null): {
  headline: string;
  subhead: string;
  body: string;
  gear: string | null;
  reveal: string | null;
  awaiting: string | null;
} {
  const reveal = item ? revealForCosmetic(who, item.id) : null;
  const next = item ? null : nextEvenUnlock(level);
  return {
    headline: 'LEVEL UP',
    subhead: `Level ${level} reached.`,
    body: 'The road remembers every step.',
    gear: item ? `New gear unlocked — ${item.label}.` : null,
    reveal,
    awaiting: next == null ? null : `Your next gear unlock awaits at Level ${next}.`,
  };
}
