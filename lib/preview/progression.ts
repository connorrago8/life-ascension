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

export function xpFraction(progression: Pick<Progression, 'xp' | 'xpToNext'>): number {
  if (progression.xpToNext <= 0) return 0;
  const fraction = progression.xp / progression.xpToNext;
  if (fraction <= 0) return 0;
  if (fraction >= 1) return 1;
  return fraction;
}

/**
 * Sample preview curve. Level 7 is the home-screen bar: 720 / 1,000.
 * Each level is PREVIEW_LEVEL_SPAN XP wide. Crossing that span is the
 * only thing that raises the level.
 */
export const PREVIEW_LEVEL_SPAN = 1000;

type LevelStep = {
  level: number;
  title: string;
  strength: number;
  agility: number;
  intelligence: number;
  endurance: number;
  luck: number;
  unlocks: readonly string[];
};

const PREVIEW_LEVELS: readonly LevelStep[] = [
  {
    level: 7,
    title: 'Wayfarer',
    strength: 4,
    agility: 5,
    intelligence: 3,
    endurance: 6,
    luck: 2,
    unlocks: [],
  },
  {
    level: 8,
    title: 'Pathfinder',
    strength: 5,
    agility: 5,
    intelligence: 3,
    endurance: 7,
    luck: 2,
    unlocks: ['+1 Strength', '+1 Endurance', 'Pathfinder title'],
  },
  {
    level: 9,
    title: 'Trailbound',
    strength: 5,
    agility: 6,
    intelligence: 4,
    endurance: 7,
    luck: 3,
    unlocks: ['+1 Agility', '+1 Intelligence', '+1 Luck', 'Trailbound title'],
  },
];

export type XpProgress = {
  level: number;
  title: string;
  xpInto: number;
  xpForNext: number;
  strength: number;
  agility: number;
  intelligence: number;
  endurance: number;
  luck: number;
  unlocks: readonly string[];
};

export function progressFromXp(totalXp: number): XpProgress {
  const gained = Number.isFinite(totalXp) ? Math.max(0, Math.floor(totalXp)) : 0;
  const index = Math.min(Math.floor(gained / PREVIEW_LEVEL_SPAN), PREVIEW_LEVELS.length - 1);
  const step = PREVIEW_LEVELS[index];
  return {
    level: step.level,
    title: step.title,
    xpInto: gained - index * PREVIEW_LEVEL_SPAN,
    xpForNext: PREVIEW_LEVEL_SPAN,
    strength: step.strength,
    agility: step.agility,
    intelligence: step.intelligence,
    endurance: step.endurance,
    luck: step.luck,
    unlocks: step.unlocks,
  };
}

/** True only when the later total sits on a higher level than the earlier one. */
export function crossedLevelThreshold(beforeXp: number, afterXp: number): boolean {
  if (!Number.isFinite(beforeXp) || !Number.isFinite(afterXp) || afterXp <= beforeXp) return false;
  return progressFromXp(afterXp).level > progressFromXp(beforeXp).level;
}

export type LevelStatChange = { label: string; before: number; after: number };

export type LevelUpView = {
  level: number;
  title: string;
  unlocks: readonly string[];
  stats: readonly LevelStatChange[];
};

/** Null when the gain stays inside the current level. */
export function levelUpView(beforeXp: number, afterXp: number): LevelUpView | null {
  if (!crossedLevelThreshold(beforeXp, afterXp)) return null;
  const before = progressFromXp(beforeXp);
  const after = progressFromXp(afterXp);
  return {
    level: after.level,
    title: after.title,
    unlocks: after.unlocks,
    stats: [
      { label: 'STR', before: before.strength, after: after.strength },
      { label: 'AGI', before: before.agility, after: after.agility },
      { label: 'INT', before: before.intelligence, after: after.intelligence },
      { label: 'END', before: before.endurance, after: after.endurance },
      { label: 'LCK', before: before.luck, after: after.luck },
    ],
  };
}

export function progressionFromTotal(totalXp: number): Progression {
  const progress = progressFromXp(totalXp);
  return {
    level: progress.level,
    title: progress.title,
    xp: progress.xpInto,
    xpToNext: progress.xpForNext,
    strength: progress.strength,
    agility: progress.agility,
    intelligence: progress.intelligence,
    endurance: progress.endurance,
    luck: progress.luck,
  };
}
