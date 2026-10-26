/**
 * Level curve from the character design board.
 *
 * XP to advance from level n to n+1 is 5 × (n + 1):
 * 10, then 15, then 20, and so on (+5 XP each level).
 * Reaching level 10 takes 270 lifetime XP. The same step continues after 10.
 */
export const XP_LEVEL_INCREMENT = 5;

export type LevelProgress = {
  level: number;
  /** XP earned inside the current level, toward the next one. */
  xpIntoLevel: number;
  /** XP required to leave the current level. */
  xpForNext: number;
};

/** XP required to go from `level` to the next level. Level 1 costs 10. */
export function xpToAdvance(level: number): number {
  const current = Math.max(1, Math.floor(level));
  return XP_LEVEL_INCREMENT * (current + 1);
}

/** Cumulative XP required to arrive at `level`. Level 1 is 0. Level 10 is 270. */
export function xpToReachLevel(level: number): number {
  const target = Math.max(1, Math.floor(level));
  if (target === 1) return 0;
  return (XP_LEVEL_INCREMENT * (target * (target + 1) - 2)) / 2;
}

/** Lifetime XP from get_lifetime_xp(), which may arrive as a number or a numeric string. */
export function coerceXp(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.floor(value));
  if (typeof value === 'bigint') {
    if (value <= BigInt(0)) return 0;
    const asNumber = Number(value);
    return Number.isSafeInteger(asNumber) ? asNumber : Number.MAX_SAFE_INTEGER;
  }
  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) {
    const parsed = Number(value.trim());
    if (Number.isSafeInteger(parsed)) return Math.max(0, parsed);
  }
  return 0;
}

export function levelFor(xp: number): LevelProgress {
  const total = coerceXp(xp);
  if (total === 0) return { level: 1, xpIntoLevel: 0, xpForNext: xpToAdvance(1) };

  const estimate = Math.floor((-1 + Math.sqrt(1 + 8 * (total / XP_LEVEL_INCREMENT + 1))) / 2);
  let level = Number.isFinite(estimate) ? Math.max(1, estimate) : 1;
  for (let step = 0; step < 8 && xpToReachLevel(level + 1) <= total; step += 1) level += 1;
  for (let step = 0; step < 8 && level > 1 && xpToReachLevel(level) > total; step += 1) level -= 1;

  const base = xpToReachLevel(level);
  return {
    level,
    xpIntoLevel: total - base,
    xpForNext: xpToAdvance(level),
  };
}

/** Share of the current level that is filled. Always in [0, 1). */
export function levelProgress(xp: number): number {
  const { xpIntoLevel, xpForNext } = levelFor(xp);
  if (xpForNext <= 0) return 0;
  const fraction = xpIntoLevel / xpForNext;
  if (fraction <= 0) return 0;
  if (fraction >= 1) return 1;
  return fraction;
}
