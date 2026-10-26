/**
 * Level, XP, and attributes for the sample adventurer.
 * Gear visuals are not an input. Nothing here is loaded from an account.
 */

export type Progression = {
  level: number;
  title: string;
  xp: number;
  xpToNext: number;
  strength: number;
  agility: number;
  intelligence: number;
  endurance: number;
  luck: number;
};

export const SAMPLE_PROGRESSION: Progression = Object.freeze({
  level: 7,
  title: 'Wayfarer',
  xp: 720,
  xpToNext: 1000,
  strength: 4,
  agility: 5,
  intelligence: 3,
  endurance: 6,
  luck: 2,
});

export function levelTitle(progression: Progression): string {
  return `LEVEL ${progression.level} — ${progression.title.toUpperCase()}`;
}

export function xpLabel(progression: Progression): string {
  return `${progression.xp.toLocaleString('en-US')} / ${progression.xpToNext.toLocaleString('en-US')}`;
}

export function xpFraction(progression: Progression): number {
  if (progression.xpToNext <= 0) return 0;
  const fraction = progression.xp / progression.xpToNext;
  if (fraction <= 0) return 0;
  if (fraction >= 1) return 1;
  return fraction;
}
