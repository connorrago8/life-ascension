/**
 * Visual identity only: hair, skin, colors, clothing, and the equipment
 * a person is wearing. This module has no stats, XP, or item bonuses.
 * Swapping a visible item changes how the person is drawn. It does not
 * store or alter gameplay numbers.
 */

export const VISIBLE_SLOTS = ['head', 'chest', 'main-hand', 'off-hand', 'feet', 'legs'] as const;

export type VisibleSlot = (typeof VISIBLE_SLOTS)[number];

export type VisibleMotif = 'hood' | 'coat' | 'staff' | 'lantern' | 'trousers' | 'boots';

/** What is drawn. Accent colors are cloth, wood, and metal — not bonuses. */
export type VisibleItem = {
  id: string;
  slot: VisibleSlot;
  name: string;
  motif: VisibleMotif;
  accent: string;
  accentLight: string;
};

export type Appearance = {
  name: string;
  hair: string;
  hairHighlight: string;
  skin: string;
  skinShadow: string;
  eye: string;
  tunic: string;
  tunicLight: string;
  trousers: string;
  trousersLight: string;
  boots: string;
  bootsLight: string;
  belt: string;
  equipment: readonly VisibleItem[];
};

export type AppearanceColors = Pick<
  Appearance,
  | 'hair'
  | 'hairHighlight'
  | 'skin'
  | 'skinShadow'
  | 'eye'
  | 'tunic'
  | 'tunicLight'
  | 'trousers'
  | 'trousersLight'
  | 'boots'
  | 'bootsLight'
  | 'belt'
>;

export const TRAVELERS_HOOD: VisibleItem = {
  id: 'travelers-hood',
  slot: 'head',
  name: "Traveler's Hood",
  motif: 'hood',
  accent: '#143D30',
  accentLight: '#1F6B52',
};

export const WAYFARER_COAT: VisibleItem = {
  id: 'wayfarer-coat',
  slot: 'chest',
  name: 'Wayfarer Coat',
  motif: 'coat',
  accent: '#1F6B52',
  accentLight: '#3D946C',
};

export const WALKING_STAFF: VisibleItem = {
  id: 'walking-staff',
  slot: 'main-hand',
  name: 'Walking Staff',
  motif: 'staff',
  accent: '#6B442C',
  accentLight: '#C4A574',
};

export const WAYFARER_LANTERN: VisibleItem = {
  id: 'wayfarer-lantern',
  slot: 'main-hand',
  name: 'Wayfarer Lantern',
  motif: 'lantern',
  accent: '#E2A23A',
  accentLight: '#FFE7A3',
};

export const TRAIL_TROUSERS: VisibleItem = {
  id: 'trail-trousers',
  slot: 'legs',
  name: 'Trail Trousers',
  motif: 'trousers',
  accent: '#5C4030',
  accentLight: '#8A6450',
};

export const WORN_BOOTS: VisibleItem = {
  id: 'worn-boots',
  slot: 'feet',
  name: 'Worn Boots',
  motif: 'boots',
  accent: '#3A2918',
  accentLight: '#6A4A32',
};

/** Sample adventurer. The same record feeds Home and Adventure. */
export const SAMPLE_APPEARANCE: Appearance = {
  name: 'Rowan Hale',
  hair: '#8C3F22',
  hairHighlight: '#E0A45A',
  skin: '#E2B088',
  skinShadow: '#C4846A',
  eye: '#1F4D45',
  tunic: '#1F6B52',
  tunicLight: '#3D946C',
  trousers: '#5C4030',
  trousersLight: '#8A6450',
  boots: '#3A2918',
  bootsLight: '#6A4A32',
  belt: '#6B442C',
  equipment: [TRAVELERS_HOOD, WAYFARER_COAT, WALKING_STAFF, TRAIL_TROUSERS, WORN_BOOTS],
};

export function equipmentInOrder(appearance: Appearance): VisibleItem[] {
  return VISIBLE_SLOTS.flatMap((slot) => {
    const item = appearance.equipment.find((entry) => entry.slot === slot);
    return item ? [item] : [];
  });
}

export function itemIds(appearance: Appearance): string[] {
  return equipmentInOrder(appearance).map((item) => item.id);
}

export function visibleItem(appearance: Appearance, slot: VisibleSlot): VisibleItem | null {
  return appearance.equipment.find((item) => item.slot === slot) ?? null;
}

/** Cosmetic edit. Equipment and every other field stay as they were. */
export function recolorAppearance(appearance: Appearance, colors: Partial<AppearanceColors>): Appearance {
  return {
    ...appearance,
    ...colors,
    equipment: appearance.equipment,
  };
}

/** Replace the visible item in one slot. Returns a new appearance. */
export function withEquippedItem(appearance: Appearance, item: VisibleItem): Appearance {
  return {
    ...appearance,
    equipment: equipmentInOrder({
      ...appearance,
      equipment: [...appearance.equipment.filter((current) => current.slot !== item.slot), item],
    }),
  };
}

/** Sample toggle: walking staff or wayfarer lantern in the main hand. */
export function swapMainHand(appearance: Appearance): Appearance {
  const held = visibleItem(appearance, 'main-hand');
  const next = held?.id === WAYFARER_LANTERN.id ? WALKING_STAFF : WAYFARER_LANTERN;
  return withEquippedItem(appearance, next);
}

export const SAMPLE_GEAR: readonly VisibleItem[] = [
  TRAVELERS_HOOD,
  WAYFARER_COAT,
  WALKING_STAFF,
  WAYFARER_LANTERN,
  TRAIL_TROUSERS,
  WORN_BOOTS,
];

export function gearById(id: string): VisibleItem | null {
  return SAMPLE_GEAR.find((item) => item.id === id) ?? null;
}

export const APPEARANCE_COLOR_KEYS = [
  'hair',
  'hairHighlight',
  'skin',
  'skinShadow',
  'eye',
  'tunic',
  'tunicLight',
  'trousers',
  'trousersLight',
  'boots',
  'bootsLight',
  'belt',
] as const satisfies readonly (keyof AppearanceColors)[];

/** Keep only real color fields. Anything else in the payload is dropped. */
export function sanitizeAppearanceColors(value: unknown): Partial<AppearanceColors> {
  if (!value || typeof value !== 'object') return {};
  const source = value as Record<string, unknown>;
  const colors: Partial<AppearanceColors> = {};
  for (const key of APPEARANCE_COLOR_KEYS) {
    const raw = source[key];
    if (typeof raw === 'string' && /^#[0-9A-Fa-f]{6}$/.test(raw)) colors[key] = raw.toUpperCase();
  }
  return colors;
}

/** Build the shared drawing from equipped ids and color overrides. */
export function appearanceFromLoadout(loadout: {
  equipmentIds: readonly string[];
  colors?: Partial<AppearanceColors>;
}): Appearance {
  const items: VisibleItem[] = [];
  for (const id of loadout.equipmentIds) {
    const gear = gearById(id);
    if (!gear) continue;
    const withoutSlot = items.filter((item) => item.slot !== gear.slot);
    items.splice(0, items.length, ...withoutSlot, gear);
  }
  return recolorAppearance(
    { ...SAMPLE_APPEARANCE, equipment: equipmentInOrder({ ...SAMPLE_APPEARANCE, equipment: items }) },
    sanitizeAppearanceColors(loadout.colors ?? {}),
  );
}
