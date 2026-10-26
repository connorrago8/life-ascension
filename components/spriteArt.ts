/** Pixel adventurer in beginner clothes. One grid, split into layers by ink. */

export const SPRITE_WIDTH = 32;

/**
 * Paint order is back to front. The cloak is behind the body so a cape
 * shows around the edges. The companion is last, beside the figure.
 * Beginner tunic, trousers, and boots stay on the body layer.
 */
export const SPRITE_LAYER_IDS = ['cloak', 'body', 'headwear', 'armor', 'shield', 'weapon', 'companion'] as const;

export type SpriteLayerId = (typeof SPRITE_LAYER_IDS)[number];

export const PALETTE: Record<string, string> = {
  H: '#4A3018',
  h: '#8A5528',
  L: '#E0A45A',
  S: '#F6CEA8',
  s: '#E2B088',
  e: '#2C241C',
  w: '#FFF9F3',
  k: '#E8A090',
  m: '#C45B58',
  T: '#1F5A44',
  t: '#3D946C',
  u: '#7EC49A',
  c: '#F4EEE4',
  B: '#6B442C',
  b: '#E6D3A6',
  P: '#3F2E24',
  p: '#6C5040',
  q: '#8E6C54',
  F: '#2E2218',
  f: '#5A3C2C',
  o: '#D7C6B0',
  /** Cosmetic gear. These inks are not used on the beginner body. */
  K: '#6E3A48',
  G: '#E2B657',
  g: '#6E4A28',
  A: '#E6EDF2',
  a: '#8E99A6',
  D: '#3E4752',
  I: '#C5CED8',
  W: '#F7FBFF',
  V: '#3C2470',
  v: '#8A68C8',
  R: '#E36A3A',
  Y: '#F6E7C1',
  N: '#1B3E73',
};

const LAYER_OF: Record<string, SpriteLayerId> = {
  H: 'body',
  h: 'body',
  L: 'body',
  S: 'body',
  s: 'body',
  e: 'body',
  w: 'body',
  k: 'body',
  m: 'body',
  T: 'body',
  t: 'body',
  u: 'body',
  c: 'body',
  B: 'body',
  b: 'body',
  P: 'body',
  p: 'body',
  q: 'body',
  F: 'body',
  f: 'body',
  o: 'body',
};

function center(middle: string): string {
  const space = SPRITE_WIDTH - middle.length;
  if (space < 0 || space % 2 !== 0) {
    throw new Error(`Sprite row must be an even fit in ${SPRITE_WIDTH}: "${middle}" (${middle.length})`);
  }
  const side = space / 2;
  return `${'.'.repeat(side)}${middle}${'.'.repeat(side)}`;
}

/**
 * Beginner clothes only: plain tunic, belt, trousers, boots.
 * No helmet, armor, or weapon. Equipment layers stay empty until gear exists.
 * The grid is centered. `.` is empty.
 */
const ROWS = [
  center('LLLL'),
  center('LLhhhhLL'),
  center('hhHHHHHHhh'),
  center('hHHHHHHHHHHh'),
  center('hhHHHHHHHHHHhh'),
  center('hHHhhhhhhhhhhHHh'),
  center('hHHSSSSSSSSSSHHh'),
  center('hHHsewsssewssHHh'),
  center('hHHssssssssssHHh'),
  center('hHHskssssssksHHh'),
  center('hHHssssmmssssHHh'),
  center('hhHSSSSSSSSSHHhh'),
  center('hhSSSSSSSSSShh'),
  center('hSSSSSSSSh'),
  center('ssssssss'),
  center('cssssssssc'),
  center('tttttttttttt'),
  center('TttttttttttttT'),
  center('SSTttttttttttttTSS'),
  center('SSTtttttuutttttTSS'),
  center('SSTtttttuutttttTSS'),
  center('SSTttttttttttttTSS'),
  center('SSTttttttttttttTSS'),
  center('SStBBBBBBBBBBBBtSS'),
  center('SSttBBBBbbBBBBttSS'),
  center('SSppppppppppppppSS'),
  center('ppppp..ppppp'),
  center('Ppppq..qpppP'),
  center('ppppp..ppppp'),
  center('Ppppp..ppppP'),
  center('ffffff..ffffff'),
  center('ffffff..ffffff'),
  center('ffffff..ffffff'),
  center('oooooo..oooooo'),
];

export const SPRITE_HEIGHT = ROWS.length;

const ART = ROWS.join('\n');

export function spriteRows(): string[] {
  return ART.split('\n');
}

export function layerRows(id: SpriteLayerId): string[] {
  return spriteRows().map((row) => [...row].map((ink) => (LAYER_OF[ink] === id ? ink : '.')).join(''));
}

export function layerHasInk(id: SpriteLayerId): boolean {
  return layerRows(id).some((row) => [...row].some((ink) => ink !== '.'));
}

/**
 * Cosmetic overlays, one per equipment slot. They paint inside that slot's
 * sprite group and never replace the body. The cloak group is behind the
 * body, so its center is covered and the cape shows around the edges.
 * The companion stands beside the figure.
 */
const GEAR_KEYS = ['headwear', 'armor', 'shield', 'weapon', 'cloak', 'companion'] as const;
type GearKey = (typeof GEAR_KEYS)[number];

function blankGrid(): string[][] {
  return Array.from({ length: SPRITE_HEIGHT }, () => Array.from({ length: SPRITE_WIDTH }, () => '.'));
}

function blit(grid: string[][], x: number, y: number, rows: readonly string[]) {
  rows.forEach((row, dy) => {
    [...row].forEach((ink, dx) => {
      if (ink === '.') return;
      const px = x + dx;
      const py = y + dy;
      if (py < 0 || px < 0 || py >= SPRITE_HEIGHT || px >= SPRITE_WIDTH) {
        throw new Error(`Gear pixel outside the sprite at ${px},${py}`);
      }
      if (!PALETTE[ink]) throw new Error(`Unknown gear ink "${ink}"`);
      grid[py][px] = ink;
    });
  });
}

function put(grid: string[][], x: number, y: number, ink: string) {
  blit(grid, x, y, [ink]);
}

function gridRows(grid: string[][]): string[] {
  return grid.map((row) => row.join(''));
}

/** Headwear. A hood over the hair, with the face left open. */
function hoodArt(): string[] {
  const grid = blankGrid();
  blit(grid, 8, 0, [
    '......GGGG......',
    '....GKKKKKKG....',
    '...GKKKKKKKKG...',
    '..GKKKKKKKKKKG..',
    '.GKKKKKKKKKKKKG.',
    'GGGGGGGGGGGGGGGG',
  ]);
  blit(grid, 8, 6, ['KKK', 'KK.', 'KK.', 'KK.', 'KK.', 'KKK', 'GGG']);
  blit(grid, 21, 6, ['KKK', '.KK', '.KK', '.KK', '.KK', 'KKK', 'GGG']);
  return gridRows(grid);
}

/** Armor over the tunic. Shoulders and a ridged breastplate. */
function armorArt(): string[] {
  const grid = blankGrid();
  blit(grid, 6, 16, ['aaaaa', 'AAAAA', 'aaaaa']);
  blit(grid, 21, 16, ['aaaaa', 'AAAAA', 'aaaaa']);
  blit(grid, 10, 17, [
    'DDDDDDDDDDDD',
    'DaaaaaaaaaaD',
    'DaAAAAaaaaaD',
    'DaaAAAaaaaaD',
    'DaaaGAAaaaaD',
    'DaaaaAAAaaaD',
    'DaaaaaaaaaaD',
    'DDDDGGDDDDDD',
  ]);
  return gridRows(grid);
}

/** Weapon skin. A decorative blade in the main hand. It does not fight. */
function weaponArt(): string[] {
  const grid = blankGrid();
  put(grid, 28, 4, 'W');
  for (let y = 5; y <= 18; y += 1) {
    put(grid, 27, y, 'I');
    put(grid, 28, y, 'W');
    put(grid, 29, y, 'I');
  }
  blit(grid, 26, 19, ['GGGGGG']);
  blit(grid, 27, 20, ['ggg', 'ggg', 'ggg']);
  blit(grid, 27, 23, ['RRR', 'GGG']);
  return gridRows(grid);
}

/** Shield on the off hand. */
function shieldArt(): string[] {
  const grid = blankGrid();
  blit(grid, 0, 16, [
    '.DDD.',
    'DAAAD',
    'DAAAD',
    'DAGAD',
    'DAGAD',
    'DAAAD',
    'DAAAD',
    '.DDD.',
    '..D..',
  ]);
  return gridRows(grid);
}

/**
 * Cloak. Wider than the body and painted in the cloak group, which is
 * behind the body, so the figure covers the middle and the cape shows
 * around the shoulders, sides, and hem.
 */
function cloakArt(): string[] {
  const grid = blankGrid();
  for (let y = 14; y <= 33; y += 1) {
    let left = 5;
    let right = 26;
    if (y <= 15) {
      left = 8;
      right = 23;
    } else if (y <= 17) {
      left = 5;
      right = 26;
    } else if (y <= 25) {
      left = 5;
      right = 25;
    } else if (y <= 29) {
      left = 4;
      right = 27;
    } else {
      left = 2;
      right = 29;
    }
    for (let x = left; x <= right; x += 1) {
      const rim = x === left || x === right || y === 14 || y === 33;
      put(grid, x, y, rim ? 'V' : (x + y) % 4 === 0 ? 'v' : 'V');
    }
  }
  put(grid, 6, 11, 'G');
  put(grid, 31, 10, 'G');
  put(grid, 30, 27, 'v');
  put(grid, 1, 28, 'G');
  return gridRows(grid);
}

/** Companion. A moth beside the figure, clear of the legs and boots. */
function companionArt(): string[] {
  const grid = blankGrid();
  blit(grid, 0, 25, [
    '.Y.Y.',
    'YYYYY',
    'YYRYY',
    'YYYYY',
    '.YYY.',
    '..D..',
    '.D.D.',
    '.D.D.',
    '.D.D.',
  ]);
  return gridRows(grid);
}

const GEAR: Record<GearKey, string[]> = {
  headwear: hoodArt(),
  armor: armorArt(),
  shield: shieldArt(),
  weapon: weaponArt(),
  cloak: cloakArt(),
  companion: companionArt(),
};

export function gearOverlay(slot: string): string[] {
  const rows = GEAR[slot as GearKey];
  if (!rows) throw new Error(`No cosmetic art for ${slot}`);
  return rows;
}

/** Overlay rows for the items that are currently worn. Empty slots paint nothing. */
export function cosmeticOverlays(
  items: readonly { slot: string; name: string }[] | null | undefined,
): Partial<Record<SpriteLayerId, string[]>> {
  const overlays: Partial<Record<SpriteLayerId, string[]>> = {};
  if (!items) return overlays;
  for (const item of items) {
    if (!item?.name?.trim()) continue;
    if (!(GEAR_KEYS as readonly string[]).includes(item.slot)) continue;
    overlays[item.slot as SpriteLayerId] = GEAR[item.slot as GearKey];
  }
  return overlays;
}
