/**
 * Default starter items: Rusty Sword (Weapon) and Rusty Armor (Armor).
 *
 * They are code-defined defaults, not owned items: whenever the Weapon or Armor
 * slot has no equipped item, the starter item is shown as equipped there.
 * Equipping real gear replaces it; unequipping real gear returns the slot to it.
 * They are not in any catalog, loot table, drop pool, inventory, vault or DB
 * row, and they carry zero stats and no passive, so combat math is unchanged.
 */
export type StarterItem = Readonly<{
  id: string;
  name: string;
  slot: 'weapon' | 'armor';
  slotLabel: string;
  stats: Readonly<Record<string, number>>;
  passive: null;
}>;

export const RUSTY_SWORD: StarterItem = Object.freeze({
  id: 'starter-rusty-sword', name: 'Rusty Sword', slot: 'weapon', slotLabel: 'Weapon', stats: Object.freeze({}), passive: null,
});
export const RUSTY_ARMOR: StarterItem = Object.freeze({
  id: 'starter-rusty-armor', name: 'Rusty Armor', slot: 'armor', slotLabel: 'Armor', stats: Object.freeze({}), passive: null,
});

export const STARTER_ITEMS: readonly StarterItem[] = Object.freeze([RUSTY_SWORD, RUSTY_ARMOR]);
export const STARTER_ITEM_IDS: readonly string[] = Object.freeze(STARTER_ITEMS.map((item) => item.id));

/** Modest rusty colors. */
export const RUST_COLORS = Object.freeze({
  rustDark: '#6E4A35',
  rust: '#A3683F',
  rustLight: '#C08A5C',
  iron: '#7D7068',
  grip: '#4A3322',
});

export function isStarterItemId(id: string | null | undefined): boolean {
  return typeof id === 'string' && STARTER_ITEM_IDS.includes(id);
}

/** The starter item for a gear slot key, if that slot has one. */
export function starterItemForSlot(slot: string): StarterItem | null {
  return STARTER_ITEMS.find((item) => item.slot === slot) ?? null;
}

export type StarterSlots = { armor: StarterItem | null; weapon: StarterItem | null };

/**
 * Which starter items are equipped by default: a slot shows its Rusty item only
 * while no real item is equipped there.
 */
export function starterSlots(filled: { armor: boolean; weapon: boolean }): StarterSlots {
  return { armor: filled.armor ? null : RUSTY_ARMOR, weapon: filled.weapon ? null : RUSTY_SWORD };
}
