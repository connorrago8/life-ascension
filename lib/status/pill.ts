/**
 * Compact status for the signed-in account only.
 * Completed/total come from that person's own quest glance.
 * XP uses the same level curve as lib/level.ts. Nothing here reads a partner.
 */

import { levelFor, levelProgress } from '../level.ts';

export type PillInput = {
  completed: number;
  remaining: number;
  streak: number;
  xp: number;
};

export type PillModel = {
  completed: number;
  total: number;
  remaining: number;
  streak: number;
  level: number;
  xpIntoLevel: number;
  xpForNext: number;
  fraction: number;
  questLabel: string;
  xpLabel: string;
  /** Quests still open today. Zero clears the app icon badge. */
  badge: number;
};

function whole(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

export function pillModel(input: PillInput): PillModel {
  const completed = whole(input.completed);
  const remaining = whole(input.remaining);
  const streak = whole(input.streak);
  const progress = levelFor(whole(input.xp));
  const total = completed + remaining;
  return {
    completed,
    total,
    remaining,
    streak,
    level: progress.level,
    xpIntoLevel: progress.xpIntoLevel,
    xpForNext: progress.xpForNext,
    fraction: levelProgress(whole(input.xp)),
    questLabel: `${completed}/${total}`,
    xpLabel: `${progress.xpIntoLevel}/${progress.xpForNext}`,
    badge: remaining,
  };
}

export function pillAriaLabel(model: PillModel, href: string): string {
  const where = href.startsWith('/companion') ? 'companion quests' : 'quests';
  const toNext = Math.max(0, model.xpForNext - model.xpIntoLevel);
  return `Today ${model.completed} of ${model.total} quests, ${toNext} XP to next level. Open ${where}.`;
}
