/**
 * Sample bag for the preview inventory.
 * Equipment ids match the visible gear. Cosmetics carry colors only.
 */

import type { AppearanceColors, VisibleSlot } from './appearance';

export type CatalogCategory = 'equipment' | 'cosmetic';

export type CatalogItem = {
  id: string;
  name: string;
  category: CatalogCategory;
  slot?: VisibleSlot;
  colors?: Partial<AppearanceColors>;
};

export const PREVIEW_CATALOG: readonly CatalogItem[] = [
  { id: 'travelers-hood', name: "Traveler's Hood", category: 'equipment', slot: 'head' },
  { id: 'wayfarer-coat', name: 'Wayfarer Coat', category: 'equipment', slot: 'chest' },
  { id: 'walking-staff', name: 'Walking Staff', category: 'equipment', slot: 'main-hand' },
  { id: 'wayfarer-lantern', name: 'Wayfarer Lantern', category: 'equipment', slot: 'main-hand' },
  { id: 'trail-trousers', name: 'Trail Trousers', category: 'equipment', slot: 'legs' },
  { id: 'worn-boots', name: 'Worn Boots', category: 'equipment', slot: 'feet' },
  { id: 'ashen-hood', name: 'Ashen Hood', category: 'equipment', slot: 'head' },
  { id: 'ember-coat', name: 'Ember Coat', category: 'equipment', slot: 'chest' },
  { id: 'dusk-trousers', name: 'Dusk Trousers', category: 'equipment', slot: 'legs' },
  { id: 'ironbound-boots', name: 'Ironbound Boots', category: 'equipment', slot: 'feet' },
  { id: 'midnight-robe-dye', name: 'Midnight Robe Dye', category: 'cosmetic', colors: { tunic: '#29324F', tunicLight: '#596C96' } },
  { id: 'forest-mantle-dye', name: 'Forest Mantle Dye', category: 'cosmetic', colors: { tunic: '#234C3E', tunicLight: '#5D9478' } },
  { id: 'sunfire-cloak-dye', name: 'Sunfire Cloak Dye', category: 'cosmetic', colors: { tunic: '#8A4329', tunicLight: '#E2A45B' } },
  { id: 'silver-hair-ribbon', name: 'Silver Hair Ribbon', category: 'cosmetic', colors: { hairHighlight: '#D1DCE8' } },
  { id: 'copper-hair-ribbon', name: 'Copper Hair Ribbon', category: 'cosmetic', colors: { hairHighlight: '#E4A16D' } },
  {
    id: 'wine-cloak-dye',
    name: 'Wine Cloak Dye',
    category: 'cosmetic',
    colors: { tunic: '#6E2438', tunicLight: '#A34B62' },
  },
  {
    id: 'gold-hair-ribbon',
    name: 'Gold Hair Ribbon',
    category: 'cosmetic',
    colors: { hairHighlight: '#F0C14A' },
  },
];

export const DEFAULT_EQUIPMENT_IDS: readonly string[] = [
  'travelers-hood',
  'wayfarer-coat',
  'walking-staff',
  'trail-trousers',
  'worn-boots',
];

export function catalogItem(id: string): CatalogItem | null {
  return PREVIEW_CATALOG.find((item) => item.id === id) ?? null;
}

export function colorsForCosmetics(ids: readonly string[]): Partial<AppearanceColors> {
  const colors: Partial<AppearanceColors> = {};
  for (const item of PREVIEW_CATALOG) {
    if (item.category !== 'cosmetic' || !ids.includes(item.id) || !item.colors) continue;
    Object.assign(colors, item.colors);
  }
  return colors;
}

export function equipCatalogId(
  equipmentIds: readonly string[],
  cosmeticIds: readonly string[],
  id: string,
): { equipmentIds: string[]; cosmeticIds: string[] } {
  const item = catalogItem(id);
  if (!item) return { equipmentIds: [...equipmentIds], cosmeticIds: [...cosmeticIds] };
  if (item.category === 'cosmetic') {
    if (cosmeticIds.includes(id)) return { equipmentIds: [...equipmentIds], cosmeticIds: [...cosmeticIds] };
    return { equipmentIds: [...equipmentIds], cosmeticIds: [...cosmeticIds, id] };
  }
  const kept = equipmentIds.filter((existing) => catalogItem(existing)?.slot !== item.slot);
  return { equipmentIds: [...kept, id], cosmeticIds: [...cosmeticIds] };
}

export function unequipCatalogId(
  equipmentIds: readonly string[],
  cosmeticIds: readonly string[],
  id: string,
): { equipmentIds: string[]; cosmeticIds: string[] } {
  return {
    equipmentIds: equipmentIds.filter((existing) => existing !== id),
    cosmeticIds: cosmeticIds.filter((existing) => existing !== id),
  };
}
