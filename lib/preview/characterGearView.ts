/** A visual boundary, not an ownership or reward authority. */
import { appearanceFromLoadout, type Appearance } from './appearance';
import type { BeltStage } from './beltProgression';

export type CharacterEquipmentMode = 'preview' | 'unverified';
export type CharacterGearView = Readonly<{
  appearance: Appearance;
  beltStage: BeltStage | undefined;
  canChange: boolean;
}>;

/**
 * Preview sessionStorage and sample equipment are never an entitlement source.
 * Until authenticated ownership + equipped state are available, fail closed:
 * no inventory actions, no sample gear, and a plain starter waist tie.
 */
export function characterGearView(mode: CharacterEquipmentMode, previewAppearance: Appearance): CharacterGearView {
  if (mode === 'preview') {
    return { appearance: previewAppearance, beltStage: undefined, canChange: true };
  }
  return {
    appearance: appearanceFromLoadout({ equipmentIds: [] }),
    beltStage: 'starter',
    canChange: false,
  };
}
