/** Adventurer (Connor) cosmetic track.
 * Matches Izzy's cadence (every 2 levels through L50) but different pieces.
 * Purely cosmetic. Does not touch Crypt XP or Ashen Hood.
 */

/** Shared with Izzy's catalog: one worn piece per slot. */
export type AdventurerSlot =
  | 'top'
  | 'bottom'
  | 'boots'
  | 'hands'
  | 'jacket'
  | 'head'
  | 'face'
  | 'hair'
  | 'tattoo'
  | 'hip'
  | 'aura'
  | 'companion'
  | 'back';

export type AdventurerCosmetic = {
  id: string;
  label: string;
  description: string;
  slot: AdventurerSlot;
  unlockLevel: number;
};

/** IDs are stable. Labels follow the founder pack; slots moved to the shared architecture. */
export const ADVENTURER_COSMETICS: readonly AdventurerCosmetic[] = [
  { id: 'shadow-hood', label: 'Wanderer’s Wraps', description: 'Worn hand wraps from the first steps of the journey.', slot: 'hands', unlockLevel: 2 },
  { id: 'leather-bracers', label: 'Iron Signet', description: 'A simple dark-metal ring carrying an unknown crest.', slot: 'face', unlockLevel: 4 },
  { id: 'dark-tunic', label: 'Ranger’s Trousers', description: 'Durable charcoal pants built for the road.', slot: 'bottom', unlockLevel: 6 },
  { id: 'road-boots', label: 'Ashen Tunic', description: 'A fitted dark shirt with subtle stitching.', slot: 'top', unlockLevel: 8 },
  { id: 'pathfinder-cloak', label: 'Blackthorn Jacket', description: 'A weathered leather jacket with reinforced shoulders.', slot: 'jacket', unlockLevel: 10 },
  { id: 'rune-belt', label: 'First Oath', description: 'A small forearm tattoo representing commitment.', slot: 'tattoo', unlockLevel: 12 },
  { id: 'iron-pauldrons', label: 'Ironbound Boots', description: 'Heavy boots made for long expeditions.', slot: 'boots', unlockLevel: 14 },
  { id: 'scarred-gloves', label: 'Wayfinder’s Circlet', description: 'An aged-metal band engraved with forgotten symbols.', slot: 'head', unlockLevel: 16 },
  { id: 'traveler-pants', label: 'Emberstreak', description: 'A faint silver-blue streak through his hair.', slot: 'hair', unlockLevel: 18 },
  { id: 'ember-circlet', label: 'Riftbrand', description: 'A cyan rune tattoo running along one arm.', slot: 'tattoo', unlockLevel: 20 },
  { id: 'void-gauntlets', label: 'Pathfinder’s Rig', description: 'A utility belt carrying tools and relics.', slot: 'hip', unlockLevel: 22 },
  { id: 'storm-cape', label: 'Voidglass Lens', description: 'A cybernetic monocular lens with luminous detailing.', slot: 'face', unlockLevel: 24 },
  { id: 'obsidian-vest', label: 'Duskwalker Coat', description: 'A long black coat with an armored collar.', slot: 'jacket', unlockLevel: 26 },
  { id: 'neon-edge-bracers', label: 'Oathbound Sigil', description: 'A magenta rune tattoo at the neck.', slot: 'tattoo', unlockLevel: 28 },
  { id: 'warden-boots', label: 'Shadowcomms', description: 'A discreet tactical headset with dark metallic plating.', slot: 'head', unlockLevel: 30 },
  { id: 'arcane-shoulders', label: 'Lantern of Resolve', description: 'A floating lantern holding a blue arcane flame.', slot: 'back', unlockLevel: 32 },
  { id: 'silver-mask', label: 'Riftbound Harness', description: 'Layered black leather armor with steel fastenings.', slot: 'top', unlockLevel: 34 },
  { id: 'longcoat', label: 'Runeforged Hands', description: 'Glowing geometric markings across both hands.', slot: 'tattoo', unlockLevel: 36 },
  { id: 'rune-lantern-pack', label: 'Nightfall Cloak', description: 'A hooded cloak with cyan-lined edges.', slot: 'jacket', unlockLevel: 38 },
  { id: 'void-aura', label: 'Sentinel Wisp', description: 'A floating arcane mechanical scout.', slot: 'companion', unlockLevel: 40 },
  { id: 'gold-filigree-armor', label: 'Obsidian Vanguard', description: 'An engraved shoulder guard of blackened steel.', slot: 'back', unlockLevel: 42 },
  { id: 'neon-trim-cloak', label: 'Ascendant’s Mark', description: 'A full-back design of interlocking arcane runes.', slot: 'tattoo', unlockLevel: 44 },
  { id: 'cyber-visor', label: 'Stormsilver Hair', description: 'Silver hair with cool blue luminous tips.', slot: 'hair', unlockLevel: 46 },
  { id: 'obsidian-pauldrons', label: 'Riftwalker Aura', description: 'A subtle field of blue and violet energy.', slot: 'aura', unlockLevel: 48 },
  { id: 'legendary-coat', label: 'Obsidian Ascendant', description: 'Legendary black armor with aged-gold filigree.', slot: 'top', unlockLevel: 50 },
];

/** Layout preview only. Not persisted and not a combat loadout. */
export const COSMETIC_LOOK_LEVEL = 24;
export const COSMETIC_LOOK_WORN = [
  'shadow-hood',
  'iron-pauldrons',
  'dark-tunic',
  'scarred-gloves',
  'traveler-pants',
  'road-boots',
  'storm-cape',
  'rune-belt',
] as const;

/** One worn id per slot. A higher unlock replaces a lower one in the same slot. */
export function visibleCosmeticIds(wornIds: readonly string[]): string[] {
  const bySlot = new Map<AdventurerSlot, { id: string; unlockLevel: number }>();
  for (const id of wornIds) {
    const item = ADVENTURER_COSMETICS.find((cosmetic) => cosmetic.id === id);
    if (!item) continue;
    const current = bySlot.get(item.slot);
    if (!current || item.unlockLevel > current.unlockLevel) {
      bySlot.set(item.slot, { id: item.id, unlockLevel: item.unlockLevel });
    }
  }
  return [...bySlot.values()].map((item) => item.id);
}
