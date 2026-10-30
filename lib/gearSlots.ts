/**
 * Approved Character equipment slots (PR #12 set) and their level gates.
 * Display and pre-check only: ownership comes from the owner-scoped server
 * snapshot, and the equip RPC independently enforces ownership AND the level gate.
 */
import { levelFor } from './level';
import type { VisibleSlot } from './preview/appearance';

export const GEAR_SLOTS = [
  { key: 'headwear', label: 'Headwear', unlockLevel: 3, rendererSlot: 'head' },
  { key: 'armor', label: 'Armor', unlockLevel: 1, rendererSlot: 'chest' },
  { key: 'shield', label: 'Shield', unlockLevel: 5, rendererSlot: 'off-hand' },
  { key: 'weapon', label: 'Weapon', unlockLevel: 1, rendererSlot: 'main-hand' },
  { key: 'cloak', label: 'Cloak', unlockLevel: 10, rendererSlot: null },
  { key: 'companion', label: 'Companion', unlockLevel: 15, rendererSlot: null },
] as const satisfies readonly { key: string; label: string; unlockLevel: number; rendererSlot: VisibleSlot | null }[];

export type GearSlotKey = (typeof GEAR_SLOTS)[number]['key'];
export type GearSlot = (typeof GEAR_SLOTS)[number];

/** Left column: headwear, armor, shield. Right column: weapon, cloak, companion. */
export const LEFT_GEAR_SLOTS: readonly GearSlot[] = GEAR_SLOTS.slice(0, 3);
export const RIGHT_GEAR_SLOTS: readonly GearSlot[] = GEAR_SLOTS.slice(3);

/**
 * Items the server equip path supports, keyed by item id. Must mirror the
 * equip_earned_armor RPC (supabase/migrations/202610290001_equip_level_gate.sql).
 */
export const SERVER_EQUIPPABLE_ITEMS: Readonly<Record<string, GearSlotKey>> = Object.freeze({
  'ashen-hood': 'headwear',
});

export function gearSlot(key: string): GearSlot | null {
  return GEAR_SLOTS.find((slot) => slot.key === key) ?? null;
}

/** Which approved slot a renderer-slot item (preview catalog) belongs to, if any. */
export function gearSlotForRendererSlot(slot: VisibleSlot | undefined): GearSlotKey | null {
  if (!slot) return null;
  return GEAR_SLOTS.find((entry) => entry.rendererSlot === slot)?.key ?? null;
}

/** A null/unknown level fails closed: only verified levels unlock slots. */
export function isSlotUnlocked(level: number | null | undefined, key: string): boolean {
  const slot = gearSlot(key);
  if (!slot || typeof level !== 'number' || !Number.isSafeInteger(level) || level < 1) return false;
  return level >= slot.unlockLevel;
}

export function slotLockText(key: string): string {
  const slot = gearSlot(key);
  return slot ? `Unlocks at Lv ${slot.unlockLevel}` : 'Locked';
}

export function levelForVerifiedXp(xp: number | null | undefined): number | null {
  if (typeof xp !== 'number' || !Number.isSafeInteger(xp) || xp < 0) return null;
  return levelFor(xp).level;
}

/** Owned server items that fit a slot. Never includes unknown/unowned ids. */
export function ownedItemsForSlot(ownedItemIds: readonly string[] | null | undefined, key: string): string[] {
  if (!ownedItemIds) return [];
  return ownedItemIds.filter((id) => SERVER_EQUIPPABLE_ITEMS[id] === key);
}

/**
 * Client-side pre-check mirroring the server. The server remains authoritative;
 * this only prevents obviously invalid requests from being sent.
 */
export function canRequestEquip(
  level: number | null,
  ownedItemIds: readonly string[] | null | undefined,
  key: string,
  itemId: string,
): boolean {
  return isSlotUnlocked(level, key)
    && SERVER_EQUIPPABLE_ITEMS[itemId] === key
    && !!ownedItemIds?.includes(itemId);
}
