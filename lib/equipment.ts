/** Cosmetic equipment. Slots stay empty until the player actually owns an item. */
export const EQUIPMENT_SLOTS = [
  { key: 'head', label: 'Head' },
  { key: 'chest', label: 'Chest' },
  { key: 'main-hand', label: 'Main Hand' },
  { key: 'off-hand', label: 'Off Hand' },
  { key: 'feet', label: 'Feet' },
  { key: 'legs', label: 'Legs' },
] as const;

export type SlotKey = (typeof EQUIPMENT_SLOTS)[number]['key'];
export type EquipmentSlot = (typeof EQUIPMENT_SLOTS)[number];

export type OwnedItem = {
  slot: SlotKey;
  name: string;
};

export function ownedItemFor(items: readonly OwnedItem[] | null | undefined, slot: SlotKey): OwnedItem | null {
  if (!items) return null;
  const found = items.find((item) => item.slot === slot && item.name.trim());
  return found ?? null;
}

/** Accessible name for a slot. Empty slots say so. Owned items use their real name. */
export function slotAccessibleLabel(slotLabel: string, item: OwnedItem | null): string {
  return item ? `${slotLabel}: ${item.name}` : `${slotLabel}: empty`;
}

export function slotsWithItems(items: readonly OwnedItem[] | null | undefined) {
  return EQUIPMENT_SLOTS.map((slot) => {
    const item = ownedItemFor(items, slot.key);
    return { slot, item, label: slotAccessibleLabel(slot.label, item) };
  });
}
