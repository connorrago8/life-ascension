/**
 * Bonuses and abilities keyed by equipped item id.
 * The catalog is a stub. Visual identity is not an input, and these
 * numbers are never written anywhere.
 */

export type EffectStat = 'strength' | 'agility' | 'intelligence' | 'endurance' | 'luck';

export type EquipmentEffects = {
  bonuses: Record<EffectStat, number>;
  abilities: readonly string[];
};

const STATS: readonly EffectStat[] = ['strength', 'agility', 'intelligence', 'endurance', 'luck'];

const STAT_LABEL: Record<EffectStat, string> = {
  strength: 'STR',
  agility: 'AGI',
  intelligence: 'INT',
  endurance: 'END',
  luck: 'LCK',
};

type CatalogEntry = {
  bonuses: Partial<Record<EffectStat, number>>;
  abilities: readonly string[];
};

/** Stubbed sample catalog. Ids match the visible items, values do not live on them. */
const CATALOG: Record<string, CatalogEntry> = {
  'travelers-hood': { bonuses: { endurance: 1 }, abilities: [] },
  'wayfarer-coat': { bonuses: { endurance: 1 }, abilities: ['Weatherworn'] },
  'walking-staff': { bonuses: { strength: 1 }, abilities: ['Steady Pace'] },
  'wayfarer-lantern': { bonuses: { luck: 2 }, abilities: ['Guiding Light'] },
  'trail-trousers': { bonuses: { agility: 1 }, abilities: [] },
  'worn-boots': { bonuses: {}, abilities: [] },
  // Real-quest earned armor. Same numbers the Crypt delve uses (lib/crypt/delve/loot.ts EARNED_GEAR).
  'ashen-hood': { bonuses: { intelligence: 1, endurance: 1 }, abilities: [] },
};

function emptyBonuses(): Record<EffectStat, number> {
  return { strength: 0, agility: 0, intelligence: 0, endurance: 0, luck: 0 };
}

export function effectsForItems(itemIds: readonly string[]): EquipmentEffects {
  const bonuses = emptyBonuses();
  const abilities: string[] = [];
  for (const id of itemIds) {
    const entry = CATALOG[id];
    if (!entry) continue;
    for (const stat of STATS) {
      bonuses[stat] += entry.bonuses[stat] ?? 0;
    }
    for (const ability of entry.abilities) abilities.push(ability);
  }
  return { bonuses, abilities };
}

/** Gameplay bonuses are this object and nothing else. */
export function gameplayBonuses(effects: EquipmentEffects): EquipmentEffects['bonuses'] {
  return effects.bonuses;
}

export function formatGearEffects(effects: EquipmentEffects): string {
  const parts = STATS.filter((stat) => effects.bonuses[stat] !== 0).map((stat) => {
    const amount = effects.bonuses[stat];
    const sign = amount > 0 ? '+' : '';
    return `${STAT_LABEL[stat]} ${sign}${amount}`;
  });
  return [...parts, ...effects.abilities].join(' · ');
}
