'use client';

import { nextLevelTier } from '../lib/companionPass';

export function NextPieceProgress({ level, xpIntoLevel = 0, xpForNext = 10 }: { level: number; xpIntoLevel?: number; xpForNext?: number }) {
  const next = nextLevelTier(level);
  if (!next) return null;
  const levelsAway = next.level - level;
  return (
    <p className="muted next-piece" role="status">
      {levelsAway <= 0 ? 'Next piece ready' : `${levelsAway} level${levelsAway === 1 ? '' : 's'} to ${next.name}`}
      {xpForNext > 0 && levelsAway > 0 && ` · ${xpIntoLevel}/${xpForNext} XP`}
    </p>
  );
}
