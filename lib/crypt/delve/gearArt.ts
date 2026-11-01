import { lootById, type Loadout, type Rarity } from './loot.ts';
import { starterSlots } from '../../starterLook.ts';

/**
 * Pixel overlays so equipped Crypt gear shows on the adventurer sprite.
 * Grids match components/spriteArt.ts (32 × 34). Inks are digits so they never
 * collide with the base sprite palette letters.
 */
export const GEAR_WIDTH = 32;
export const GEAR_HEIGHT = 34;

export const GEAR_INKS: Record<string, string> = {
  '1': '#1b1d22',
  '2': '#8d97a3',
  '3': '#dbe2e9',
  '4': '#b8a58a',
  '5': '#4fae6a',
  '6': '#4a86e8',
  '7': '#a56be0',
  '8': '#e2b23a',
  // Rusty starter items (0-stat defaults): dark rust and rust.
  '9': '#6e4a35',
  '0': '#a3683f',
};

const RARITY_INK: Record<Rarity, string> = { common: '4', uncommon: '5', rare: '6', epic: '7' };

type Grid = string[][];
function blank(): Grid {
  const grid: Grid = [];
  for (let y = 0; y < GEAR_HEIGHT; y += 1) grid.push(new Array<string>(GEAR_WIDTH).fill('.'));
  return grid;
}
function paint(grid: Grid, x0: number, y0: number, x1: number, y1: number, ink: string) {
  for (let y = Math.max(0, y0); y <= Math.min(GEAR_HEIGHT - 1, y1); y += 1) {
    for (let x = Math.max(0, x0); x <= Math.min(GEAR_WIDTH - 1, x1); x += 1) grid[y][x] = ink;
  }
}
function rows(grid: Grid): string[] {
  return grid.map((row) => row.join(''));
}

function helm(rarity: Rarity, crown: boolean): string[] {
  const g = blank();
  const trim = RARITY_INK[rarity];
  if (crown) {
    paint(g, 9, 3, 22, 5, '8');
    for (const x of [9, 13, 18, 22]) paint(g, x, 0, x, 2, '8');
    paint(g, 15, 4, 16, 4, trim);
    return rows(g);
  }
  // Rounded cap over the hair, rarity band at the brow.
  const spans: [number, number][] = [[14, 17], [12, 19], [11, 20], [10, 21], [9, 22]];
  spans.forEach(([a, b], y) => paint(g, a, y, b, y, '2'));
  paint(g, 12, 1, 13, 1, '3');
  paint(g, 8, 5, 23, 5, trim);
  return rows(g);
}

function armor(rarity: Rarity): string[] {
  const g = blank();
  const trim = RARITY_INK[rarity];
  paint(g, 10, 17, 21, 22, '2');
  paint(g, 9, 18, 9, 22, '1');
  paint(g, 22, 18, 22, 22, '1');
  paint(g, 11, 17, 20, 17, '3');
  paint(g, 15, 18, 16, 22, trim);
  if (rarity === 'rare' || rarity === 'epic') {
    paint(g, 7, 16, 9, 17, '2');
    paint(g, 22, 16, 24, 17, '2');
  }
  return rows(g);
}

function weapon(rarity: Rarity, long: boolean): string[] {
  const g = blank();
  const trim = RARITY_INK[rarity];
  const top = long ? 3 : 9;
  paint(g, 26, top, 26, 21, '3');
  paint(g, 27, top + 1, 27, 21, '2');
  if (long) paint(g, 25, top, 28, top + 2, trim);
  paint(g, 24, 22, 29, 22, trim);
  paint(g, 26, 23, 27, 25, '1');
  return rows(g);
}

function shield(rarity: Rarity): string[] {
  const g = blank();
  const trim = RARITY_INK[rarity];
  paint(g, 1, 17, 7, 24, '1');
  paint(g, 2, 18, 6, 23, trim);
  paint(g, 2, 25, 6, 25, '1');
  paint(g, 3, 26, 5, 26, '1');
  paint(g, 4, 20, 4, 21, '8');
  return rows(g);
}

/** Rusty Armor: a dull, rust-streaked breastplate over the tunic. Visual of a 0-stat default item. */
export function rustyArmorOverlay(): string[] {
  const g = blank();
  paint(g, 10, 17, 21, 22, '9');
  paint(g, 11, 17, 20, 17, '0');
  paint(g, 15, 18, 16, 22, '0');
  for (const [x, y] of [[11, 19], [20, 19], [12, 21], [19, 21]]) paint(g, x, y, x, y, '0');
  return rows(g);
}

/** Rusty Sword: short, rust-brown blade and a plain grip. Visual of a 0-stat default item. */
export function rustySwordOverlay(): string[] {
  const g = blank();
  paint(g, 26, 11, 26, 21, '0');
  paint(g, 27, 13, 27, 20, '9');
  paint(g, 24, 22, 29, 22, '9');
  paint(g, 26, 23, 27, 25, '1');
  return rows(g);
}

/**
 * Overlays keyed by AdventurerSprite layer id. An empty Weapon or Armor slot shows
 * its default Rusty Sword / Rusty Armor (pass { starter: false } to disable);
 * real gear in a slot always replaces it. Helm and shield add nothing when empty.
 */
export function gearOverlays(loadout: Loadout, options: { starter?: boolean } = {}): Partial<Record<'head' | 'chest' | 'main-hand' | 'off-hand', string[]>> {
  const result: Partial<Record<'head' | 'chest' | 'main-hand' | 'off-hand', string[]>> = {};
  const w = loadout.weapon ? lootById(loadout.weapon) : null;
  const h = loadout.helm ? lootById(loadout.helm) : null;
  const a = loadout.armor ? lootById(loadout.armor) : null;
  const s = loadout.shield ? lootById(loadout.shield) : null;
  if (w) result['main-hand'] = weapon(w.rarity, w.id === 'warden-glaive');
  if (h) result.head = helm(h.rarity, h.id === 'hollow-crown');
  if (a) result.chest = armor(a.rarity);
  if (s) result['off-hand'] = shield(s.rarity);
  if (options.starter !== false) {
    const starter = starterSlots({ armor: Boolean(a), weapon: Boolean(w) });
    if (starter.armor) result.chest = rustyArmorOverlay();
    if (starter.weapon) result['main-hand'] = rustySwordOverlay();
  }
  return result;
}

/** Names of what the hero wears: real gear, or the default Rusty Sword / Rusty Armor in empty slots. */
export function wornGearLabels(loadout: Loadout): string[] {
  const name = (id: string | undefined) => (id ? lootById(id)?.name ?? null : null);
  const starter = starterSlots({ armor: Boolean(name(loadout.armor)), weapon: Boolean(name(loadout.weapon)) });
  return [
    name(loadout.weapon) ?? starter.weapon?.name ?? null,
    name(loadout.armor) ?? starter.armor?.name ?? null,
    name(loadout.helm),
    name(loadout.shield),
  ].filter((label): label is string => Boolean(label));
}
