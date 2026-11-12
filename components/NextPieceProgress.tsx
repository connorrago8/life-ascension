'use client';

import { nextLevelTier, PASS_TIERS } from '../lib/companionPass';

export function NextPieceProgress({ level, xpIntoLevel = 0, xpForNext = 10 }: { level: number; xpIntoLevel?: number; xpForNext?: number }) {
  const next = nextLevelTier(PASS_TIERS.map((tier) => ({
    id: tier.id,
    owned: tier.grantKind === 'level' && tier.unlockLevel <= level,
    unlockLevel: tier.unlockLevel,
    grantKind: tier.grantKind,
  })));
  if (!next) return null;
  const name = PASS_TIERS.find((tier) => tier.id === next.id)?.label ?? next.id;
  const levelsAway = next.unlockLevel - level;
  return (
    <p className="muted next-piece" role="status">
      {levelsAway <= 0 ? 'Next piece ready' : `${levelsAway} level${levelsAway === 1 ? '' : 's'} to ${name}`}
      {xpForNext > 0 && levelsAway > 0 && ` · ${xpIntoLevel}/${xpForNext} XP`}
    </p>
  );
}
