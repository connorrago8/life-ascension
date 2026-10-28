/** A visual boundary, not an ownership or reward authority. */
import { appearanceFromLoadout, type Appearance } from './appearance';
import type { BeltStage } from './beltProgression';

/**
 * This value must eventually come from a signed-in, owner-scoped server RPC.
 * It is NOT an entitlement token: the database must separately authorize
 * claims and equip writes. Preview/sessionStorage and XP totals are excluded.
 */
export type AuthenticatedGearSnapshot = Readonly<{
  ownedItemIds: readonly string[];
  equippedItemIds: readonly string[];
}>;

export type CharacterEquipmentMode = 'preview' | 'unverified' | 'verified';
export type CharacterGearView = Readonly<{
  appearance: Appearance;
  beltStage: BeltStage | undefined;
  canChange: boolean;
  source: CharacterEquipmentMode;
}>;

/**
 * Render only the first approved armor from an authenticated ownership AND
 * equipped-state snapshot. Even a valid XP total cannot unlock this display.
 * No local equip action is exposed until the server equip RPC is integrated.
 */
export function characterGearView(
  mode: CharacterEquipmentMode,
  previewAppearance: Appearance,
  snapshot?: AuthenticatedGearSnapshot | null,
): CharacterGearView {
  if (mode === 'preview') {
    return { appearance: previewAppearance, beltStage: undefined, canChange: true, source: 'preview' };
  }
  if (mode === 'verified' &&
      Array.isArray(snapshot?.ownedItemIds) &&
      Array.isArray(snapshot?.equippedItemIds)) {
    const hasOwnedArmor = snapshot.ownedItemIds.includes('ashen-hood');
    const isEquipped = hasOwnedArmor && snapshot.equippedItemIds.includes('ashen-hood');
    return {
      appearance: appearanceFromLoadout({ equipmentIds: isEquipped ? ['ashen-hood'] : [] }),
      beltStage: 'starter',
      canChange: false,
      source: 'verified',
    };
  }
  // Missing/malformed server data fails closed. Never fall back to preview.
  return {
    appearance: appearanceFromLoadout({ equipmentIds: [] }),
    beltStage: 'starter',
    canChange: false,
    source: 'unverified',
  };
}
