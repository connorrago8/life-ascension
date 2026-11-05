/** Pixel adventurer in beginner clothes. One grid, split into layers by ink. */

export const SPRITE_WIDTH = 32;

/** Base body, then one layer per equipment slot. Later gear paints into the slot layers. */
export const SPRITE_LAYER_IDS = ['body', 'head', 'chest', 'main-hand', 'off-hand', 'legs', 'feet'] as const;

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
  T: 'chest',
  t: 'chest',
  u: 'chest',
  c: 'chest',
  B: 'chest',
  b: 'chest',
  P: 'legs',
  p: 'legs',
  q: 'legs',
  F: 'feet',
  f: 'feet',
  o: 'feet',
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
 * No helmet, armor, or weapon. Head and hand layers stay empty until gear exists.
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
