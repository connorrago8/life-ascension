import { nextRoll, nextWeighted, type Rng } from './rng.ts';
import { ATTRIBUTE_KEYS, ATTRIBUTE_INFO, ZERO_ATTRIBUTES, addAttributes, type Attributes } from './stats.ts';

/**
 * Crypt gear. Each piece adds attribute points while equipped and shows on your sprite.
 * Gear never grants XP, levels or quest-earned equipment.
 * Item ids are mirrored by the crypt_loot SQL allowlist (tests keep them in sync).
 */
export const LOOT_SLOTS = ['weapon', 'helm', 'armor', 'shield'] as const;
export type LootSlot = (typeof LOOT_SLOTS)[number];
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic';

export type LootItem = {
  id: string;
  name: string;
  slot: LootSlot;
  rarity: Rarity;
  bonus: Partial<Attributes>;
  flavor: string;
  /** Earned outside the Crypt (real-quest armor). Never drops and is never claimed here. */
  earnedOnly?: boolean;
};

function item(id: string, name: string, slot: LootSlot, rarity: Rarity, bonus: Partial<Attributes>, flavor: string): LootItem {
  return { id, name, slot, rarity, bonus, flavor };
}

/** Crypt drops. Rarity budget: common 1, uncommon 2, rare 4, epic 6 points. */
export const LOOT: readonly LootItem[] = [
  item('rusty-shortsword', 'Rusty Shortsword', 'weapon', 'common', { strength: 1 }, 'Still sharp where it counts.'),
  item('bone-cleaver', 'Bone Cleaver', 'weapon', 'uncommon', { strength: 2 }, 'Heavy, honest, and a little grim.'),
  item('ember-blade', 'Ember Blade', 'weapon', 'rare', { strength: 2, intelligence: 2 }, 'The edge glows when you breathe on it.'),
  item('warden-glaive', "Warden's Glaive", 'weapon', 'epic', { strength: 3, agility: 1, luck: 2 }, 'Taken from the Hollow Warden itself.'),
  item('leather-cap', 'Leather Cap', 'helm', 'common', { luck: 1 }, 'Smells of old rain. Lucky, somehow.'),
  item('scholar-circlet', "Scholar's Circlet", 'helm', 'uncommon', { intelligence: 2 }, 'Thoughts come a little quicker.'),
  item('sentinel-helm', 'Sentinel Helm', 'helm', 'rare', { intelligence: 2, luck: 2 }, 'The visor sees weak points.'),
  item('hollow-crown', 'Hollow Crown', 'helm', 'epic', { intelligence: 3, luck: 3 }, 'The Warden wore it. Now it listens to you.'),
  item('tattered-gambeson', 'Tattered Gambeson', 'armor', 'common', { endurance: 1 }, 'Patched more than it was ever stitched.'),
  item('grave-mail', 'Grave Mail', 'armor', 'uncommon', { endurance: 2 }, 'Cold rings that remember an older war.'),
  item('sentinel-plate', 'Sentinel Plate', 'armor', 'rare', { endurance: 3, strength: 1 }, 'Heavy, but nothing gets through easily.'),
  item('warden-mantle', "Warden's Mantle", 'armor', 'epic', { endurance: 4, agility: 2 }, 'Black stone woven like cloth.'),
  item('plank-buckler', 'Plank Buckler', 'shield', 'common', { endurance: 1 }, 'A door, once.'),
  item('iron-heater', 'Iron Heater Shield', 'shield', 'uncommon', { endurance: 1, agility: 1 }, 'Dented in all the right places.'),
  item('moth-ward', 'Moth Ward', 'shield', 'rare', { agility: 3, luck: 1 }, 'It flutters when danger is near.'),
  item('warden-aegis', "Warden's Aegis", 'shield', 'epic', { endurance: 3, agility: 3 }, 'A shield of black stone that hums faintly.'),
];

/**
 * Real-quest earned armor that also works in the Crypt when you own it
 * (read from the owner-scoped earned-gear snapshot). Same stats as the Character sheet.
 */
export const EARNED_GEAR: readonly LootItem[] = [
  { ...item('ashen-hood', 'Ashen Hood', 'helm', 'uncommon', { intelligence: 1, endurance: 1 }, 'Earned on real quests. Ash-grey and warm.'), earnedOnly: true },
];

export const LOOT_IDS: readonly string[] = LOOT.map((entry) => entry.id);
export const RARITY_LABEL: Record<Rarity, string> = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', epic: 'Epic' };

export function lootById(id: string): LootItem | null {
  return LOOT.find((entry) => entry.id === id) ?? EARNED_GEAR.find((entry) => entry.id === id) ?? null;
}

/** Only the earned items you actually own (unknown ids are dropped). */
export function ownedEarnedGear(ownedItemIds: readonly unknown[] | null | undefined): string[] {
  if (!Array.isArray(ownedItemIds)) return [];
  const result: string[] = [];
  for (const entry of EARNED_GEAR) if (ownedItemIds.includes(entry.id)) result.push(entry.id);
  return result;
}

export type LootSource = 'fight' | 'elite' | 'treasure' | 'event' | 'boss';

const DROP_CHANCE: Record<LootSource, number> = { fight: 0.4, elite: 1, treasure: 1, event: 1, boss: 1 };
const RARITY_WEIGHTS: Record<LootSource, readonly (readonly [Rarity, number])[]> = {
  fight: [['common', 70], ['uncommon', 25], ['rare', 5]],
  elite: [['common', 5], ['uncommon', 60], ['rare', 35]],
  treasure: [['common', 40], ['uncommon', 45], ['rare', 15]],
  event: [['common', 55], ['uncommon', 35], ['rare', 10]],
  boss: [['epic', 1]],
};

const RARITY_ORDER: readonly Rarity[] = ['common', 'uncommon', 'rare', 'epic'];

/** LCK: +1.5% drop chance per point on regular fights (up to 75%). */
export function dropChance(source: LootSource, luck = 0): number {
  if (source !== 'fight') return DROP_CHANCE[source];
  return Math.min(0.75, DROP_CHANCE.fight + Math.max(0, luck) * 0.015);
}

/** LCK: 2% per point (up to 40%) to bump a drop up one rarity (never to epic outside the boss). */
export function rarityUpChance(luck = 0): number {
  return Math.min(0.4, Math.max(0, luck) * 0.02);
}

/** Roll a drop. Null when nothing drops. Deterministic for the same rng state. */
export function rollLoot(rng: Rng, source: LootSource, luck = 0): [LootItem | null, Rng] {
  const [chance, afterChance] = nextRoll(rng);
  if (chance >= dropChance(source, luck)) return [null, afterChance];
  const [rolled, afterRarity] = nextWeighted(afterChance, RARITY_WEIGHTS[source]);
  const [bump, afterBump] = nextRoll(afterRarity);
  let rarity = rolled;
  const index = RARITY_ORDER.indexOf(rolled);
  if (rolled !== 'epic' && bump < rarityUpChance(luck) && RARITY_ORDER[index + 1] !== 'epic') rarity = RARITY_ORDER[index + 1];
  const pool = LOOT.filter((entry) => entry.rarity === rarity);
  const [pick, afterPick] = nextRoll(afterBump);
  return [pool[Math.min(pool.length - 1, Math.floor(pick * pool.length))], afterPick];
}

export function itemScore(entry: LootItem): number {
  let total = 0;
  for (const key of ATTRIBUTE_KEYS) total += entry.bonus[key] ?? 0;
  return total;
}

export type Loadout = Partial<Record<LootSlot, string>>;

/** Is `entry` better than what is in its slot now? */
export function isUpgrade(loadout: Loadout, entry: LootItem): boolean {
  const current = loadout[entry.slot] ? lootById(loadout[entry.slot] as string) : null;
  return !current || itemScore(entry) > itemScore(current);
}

/** Best item per slot from a list of ids. Unknown ids are ignored. */
export function bestLoadout(itemIds: readonly string[]): Loadout {
  const loadout: Loadout = {};
  for (const id of itemIds) {
    const entry = lootById(id);
    if (entry && isUpgrade(loadout, entry)) loadout[entry.slot] = entry.id;
  }
  return loadout;
}

export function gearAttributes(loadout: Loadout): Attributes {
  let total: Attributes = { ...ZERO_ATTRIBUTES };
  for (const slot of LOOT_SLOTS) {
    const entry = loadout[slot] ? lootById(loadout[slot] as string) : null;
    if (entry) total = addAttributes(total, entry.bonus);
  }
  return total;
}

export function bonusLabel(entry: LootItem): string {
  const parts: string[] = [];
  for (const key of ATTRIBUTE_KEYS) {
    const amount = entry.bonus[key];
    if (amount) parts.push(`+${amount} ${ATTRIBUTE_INFO[key].short}`);
  }
  return parts.join(' · ');
}
