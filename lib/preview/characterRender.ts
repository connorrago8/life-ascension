/**
 * One appearance, two drawings.
 * Home reads the illustrated model. Adventure reads the pixel palette and overlays.
 * Neither model carries stats or gameplay numbers.
 */

import type { Appearance, VisibleItem, VisibleSlot } from './appearance';

const SLOT_ORDER: readonly VisibleSlot[] = ['head', 'chest', 'main-hand', 'off-hand', 'feet', 'legs'];

function equipmentInOrder(appearance: Appearance): VisibleItem[] {
  return SLOT_ORDER.flatMap((slot) => {
    const item = appearance.equipment.find((entry) => entry.slot === slot);
    return item ? [item] : [];
  });
}

function visibleItem(appearance: Appearance, slot: VisibleSlot): VisibleItem | null {
  return appearance.equipment.find((item) => item.slot === slot) ?? null;
}

/** Same grid as the shared adventurer sprite. Kept local so this module stays free of UI imports. */
const SPRITE_WIDTH = 32;
const SPRITE_HEIGHT = 34;
const SPRITE_LAYER_IDS = ['body', 'head', 'chest', 'main-hand', 'off-hand', 'legs', 'feet'] as const;
type SpriteLayerId = (typeof SPRITE_LAYER_IDS)[number];

export type HomeCharacterModel = {
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
  hood: string | null;
  hoodLight: string | null;
  mainHand: string;
  mainHandAccent: string;
  mainHandAccentLight: string;
  motifs: readonly string[];
  itemNames: readonly string[];
  signature: string;
};

export type AdventureCharacterModel = {
  name: string;
  hair: string;
  skin: string;
  tunic: string;
  eye: string;
  palette: Record<string, string>;
  overlays: Partial<Record<SpriteLayerId, string[]>>;
  mainHand: string;
  itemNames: readonly string[];
  overlaySignature: string;
};

function clamp(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function parseHex(hex: string): [number, number, number] {
  const value = hex.replace('#', '');
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

function mixHex(from: string, to: string, amount: number): string {
  const start = parseHex(from);
  const end = parseHex(to);
  const channel = (index: number) => clamp(start[index] + (end[index] - start[index]) * amount);
  return `#${[0, 1, 2].map((index) => channel(index).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

function shadeHex(hex: string, amount: number): string {
  return amount < 0 ? mixHex(hex, '#000000', -amount) : mixHex(hex, '#FFFFFF', amount);
}

function blankGrid(): string[] {
  return Array.from({ length: SPRITE_HEIGHT }, () => '.'.repeat(SPRITE_WIDTH));
}

function paint(rows: string[], x: number, y: number, ink: string) {
  if (y < 0 || x < 0 || y >= rows.length || x >= SPRITE_WIDTH) return;
  const cells = rows[y].split('');
  cells[x] = ink;
  rows[y] = cells.join('');
}

function paintHood(rows: string[]) {
  for (let x = 11; x <= 20; x += 1) paint(rows, x, 0, 'D');
  for (let x = 10; x <= 21; x += 1) paint(rows, x, 1, 'D');
  for (let x = 9; x <= 12; x += 1) paint(rows, x, 2, 'D');
  for (let x = 19; x <= 22; x += 1) paint(rows, x, 2, 'D');
  for (let y = 3; y <= 8; y += 1) {
    paint(rows, 8, y, 'd');
    paint(rows, 9, y, 'D');
    paint(rows, 22, y, 'D');
    paint(rows, 23, y, 'd');
  }
  for (let y = 9; y <= 12; y += 1) {
    paint(rows, 8, y, 'd');
    paint(rows, 23, y, 'd');
  }
}

function paintStaff(rows: string[]) {
  for (let y = 4; y <= 33; y += 1) {
    paint(rows, 4, y, 'R');
    paint(rows, 5, y, 'r');
  }
  for (let x = 3; x <= 6; x += 1) paint(rows, x, 4, 'r');
  for (let x = 3; x <= 6; x += 1) paint(rows, x, 33, 'R');
  for (let y of [19, 20, 21]) {
    paint(rows, 6, y, 'r');
    paint(rows, 7, y, 'R');
  }
}

function paintLantern(rows: string[]) {
  for (let y = 13; y <= 16; y += 1) paint(rows, 5, y, 'N');
  for (let x = 3; x <= 7; x += 1) paint(rows, x, 16, 'N');
  for (let y = 17; y <= 22; y += 1) {
    for (let x = 3; x <= 7; x += 1) paint(rows, x, y, x > 3 && x < 7 && y > 17 && y < 22 ? 'Y' : 'N');
  }
  paint(rows, 5, 19, 'y');
  paint(rows, 5, 20, 'y');
  for (let x = 3; x <= 7; x += 1) paint(rows, x, 23, 'N');
  paint(rows, 2, 18, 'y');
  paint(rows, 8, 19, 'Y');
  paint(rows, 2, 21, 'Y');
  paint(rows, 8, 20, 'y');
}

function paintSword(rows: string[]) {
  // Thin bright blade, horizontal guard and wrapped grip. All pixels stay in bounds.
  for (let y = 5; y <= 19; y += 1) {
    paint(rows, 5, y, 'I');
    paint(rows, 6, y, 'i');
  }
  paint(rows, 5, 4, 'i');
  for (let x = 3; x <= 8; x += 1) paint(rows, x, 20, 'G');
  for (let y = 21; y <= 26; y += 1) paint(rows, 5, y, 'g');
  for (let x = 4; x <= 6; x += 1) paint(rows, x, 27, 'G');
}

function overlaysFor(equipment: readonly VisibleItem[]): Partial<Record<SpriteLayerId, string[]>> {
  const overlays: Partial<Record<SpriteLayerId, string[]>> = {};
  const hood = equipment.find((item) => item.motif === 'hood');
  const main = equipment.find((item) => item.slot === 'main-hand');
  if (hood) {
    const rows = blankGrid();
    paintHood(rows);
    overlays.head = rows;
  }
  if (main?.motif === 'staff' || main?.motif === 'lantern' || main?.motif === 'sword') {
    const rows = blankGrid();
    if (main.motif === 'staff') paintStaff(rows);
    else if (main.motif === 'lantern') paintLantern(rows);
    else paintSword(rows);
    overlays['main-hand'] = rows;
  }
  return overlays;
}

export function pixelPalette(appearance: Appearance): Record<string, string> {
  const hood = visibleItem(appearance, 'head');
  const main = visibleItem(appearance, 'main-hand');
  return {
    H: shadeHex(appearance.hair, -0.28),
    h: appearance.hair.toUpperCase(),
    L: appearance.hairHighlight.toUpperCase(),
    S: shadeHex(appearance.skin, 0.16),
    s: appearance.skin.toUpperCase(),
    e: appearance.eye.toUpperCase(),
    w: '#FFF9F3',
    k: mixHex(appearance.skin, '#C45B58', 0.35),
    m: shadeHex(mixHex(appearance.skin, '#8A3030', 0.55), -0.05),
    T: shadeHex(appearance.tunic, -0.22),
    t: appearance.tunic.toUpperCase(),
    u: appearance.tunicLight.toUpperCase(),
    c: shadeHex(appearance.skin, 0.32),
    B: shadeHex(appearance.belt, -0.18),
    b: appearance.belt.toUpperCase(),
    P: shadeHex(appearance.trousers, -0.22),
    p: appearance.trousers.toUpperCase(),
    q: appearance.trousersLight.toUpperCase(),
    F: shadeHex(appearance.boots, -0.28),
    f: appearance.boots.toUpperCase(),
    o: appearance.bootsLight.toUpperCase(),
    D: (hood?.accent ?? shadeHex(appearance.tunic, -0.35)).toUpperCase(),
    d: (hood?.accentLight ?? appearance.tunic).toUpperCase(),
    R: (main?.motif === 'staff' ? main.accent : '#6B442C').toUpperCase(),
    r: (main?.motif === 'staff' ? main.accentLight : '#C4A574').toUpperCase(),
    Y: (main?.motif === 'lantern' ? main.accentLight : '#FFE7A3').toUpperCase(),
    y: (main?.motif === 'lantern' ? main.accent : '#E2A23A').toUpperCase(),
    N: '#3E4650',
    n: '#F4E2B8',
    I: (main?.motif === 'sword' ? main.accent : '#697D8A').toUpperCase(),
    i: (main?.motif === 'sword' ? main.accentLight : '#E3EDF0').toUpperCase(),
    G: '#C6A66D',
    g: '#51392C',
  };
}

function itemNames(appearance: Appearance): string[] {
  return equipmentInOrder(appearance).map((item) => item.name);
}

export function homeCharacterModel(appearance: Appearance): HomeCharacterModel {
  const equipment = equipmentInOrder(appearance);
  const hood = equipment.find((item) => item.motif === 'hood') ?? null;
  const main = visibleItem(appearance, 'main-hand');
  const motifs = equipment.map((item) => item.motif);
  const names = itemNames(appearance);
  const mainHand = main?.motif ?? 'none';
  return {
    name: appearance.name,
    hair: appearance.hair.toUpperCase(),
    hairHighlight: appearance.hairHighlight.toUpperCase(),
    skin: appearance.skin.toUpperCase(),
    skinShadow: appearance.skinShadow.toUpperCase(),
    eye: appearance.eye.toUpperCase(),
    tunic: appearance.tunic.toUpperCase(),
    tunicLight: appearance.tunicLight.toUpperCase(),
    trousers: appearance.trousers.toUpperCase(),
    trousersLight: appearance.trousersLight.toUpperCase(),
    boots: appearance.boots.toUpperCase(),
    bootsLight: appearance.bootsLight.toUpperCase(),
    belt: appearance.belt.toUpperCase(),
    hood: hood ? hood.accent.toUpperCase() : null,
    hoodLight: hood ? hood.accentLight.toUpperCase() : null,
    mainHand,
    mainHandAccent: (main?.accent ?? appearance.belt).toUpperCase(),
    mainHandAccentLight: (main?.accentLight ?? appearance.belt).toUpperCase(),
    motifs,
    itemNames: names,
    signature: [appearance.hair, appearance.skin, appearance.eye, appearance.tunic, mainHand, names.join('|')].join('~'),
  };
}

export function adventureCharacterModel(appearance: Appearance): AdventureCharacterModel {
  const equipment = equipmentInOrder(appearance);
  const overlays = overlaysFor(equipment);
  const main = visibleItem(appearance, 'main-hand');
  const overlaySignature = SPRITE_LAYER_IDS.map((id) => (overlays[id] ?? []).join('')).join('#');
  return {
    name: appearance.name,
    hair: appearance.hair.toUpperCase(),
    skin: appearance.skin.toUpperCase(),
    tunic: appearance.tunic.toUpperCase(),
    eye: appearance.eye.toUpperCase(),
    palette: pixelPalette(appearance),
    overlays,
    mainHand: main?.motif ?? 'none',
    itemNames: itemNames(appearance),
    overlaySignature,
  };
}

export function homeAriaLabel(model: HomeCharacterModel): string {
  return `${model.name}. Hair ${model.hair}. Main hand ${model.mainHand}. ${model.itemNames.join(', ')}`;
}

export function adventureAriaLabel(model: AdventureCharacterModel): string {
  return `${model.name}. Hair ${model.hair}. Main hand ${model.mainHand}. ${model.itemNames.join(', ')}`;
}
