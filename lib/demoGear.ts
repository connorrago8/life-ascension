import { EQUIPMENT_SLOTS, type OwnedItem, type SlotKey } from './equipment';

export type DemoItem = OwnedItem & { kind: string };

/** One hard-coded cosmetic for each slot. Kinds are the approved cosmetic set. */
const SAMPLE: Record<SlotKey, { name: string; kind: string }> = {
  head: { name: 'Wayfarer Hood', kind: 'Headwear' },
  chest: { name: 'Quilted Armor', kind: 'Armor' },
  'main-hand': { name: 'Ember Blade Skin', kind: 'Weapon skin' },
  'off-hand': { name: 'Kite Shield', kind: 'Shield' },
  legs: { name: 'Dusk Cloak', kind: 'Cloak / aura' },
  feet: { name: 'Field Banner', kind: 'Banner / companion' },
};

export const DEMO_ITEMS: readonly DemoItem[] = EQUIPMENT_SLOTS.map((slot) => ({
  slot: slot.key,
  name: SAMPLE[slot.key].name,
  kind: SAMPLE[slot.key].kind,
}));

export const DEMO_BANNER = 'Demo items. Nothing is saved.';

export const DEMO_COSMETIC_NOTE = 'Cosmetics only. They do not change stats, XP, or combat.';

export const DEMO_SLOT_NOTE = 'One sample for each slot: headwear, armor, weapon skin, shield, cloak/aura, and banner/companion.';

/** Display only. The demo does not read or grant lifetime XP. */
export const DEMO_XP = 0;

export const DEMO_LEVEL = 1;

export const DEMO_XP_INTO_LEVEL = 0;

/** Level 1 advances after 10 XP. Kept here so the demo does not import the XP helpers. */
export const DEMO_XP_FOR_NEXT = 10;

export const DEMO_NAME = 'Adventurer';

export function demoItemFor(slot: SlotKey): DemoItem {
  const item = DEMO_ITEMS.find((entry) => entry.slot === slot);
  if (!item) throw new Error(`Missing demo item for ${slot}`);
  return item;
}

/** Everything starts worn so the preview shows gear on the sprite. */
export function initialEquippedSlots(): SlotKey[] {
  return DEMO_ITEMS.map((item) => item.slot);
}

/** Toggle one slot. The input is not mutated. Unknown keys are ignored. */
export function toggleEquipped(equipped: readonly SlotKey[], slot: SlotKey): SlotKey[] {
  const next = new Set(equipped);
  if (next.has(slot)) next.delete(slot);
  else next.add(slot);
  return EQUIPMENT_SLOTS.map((entry) => entry.key).filter((key) => next.has(key));
}

export function itemsFromEquipped(equipped: readonly SlotKey[]): DemoItem[] {
  const worn = new Set(equipped);
  return DEMO_ITEMS.filter((item) => worn.has(item.slot));
}
