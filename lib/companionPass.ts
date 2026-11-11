/** Cosmetic battle pass. Levels follow lib/level.ts. The server grants rows; this list is the art and the order. */

export type PassSlot = 'accent' | 'shirt' | 'pin' | 'head' | 'gown' | 'boots' | 'wand' | 'pet' | 'aura' | 'wings' | 'frame' | 'accessory';

export type PassTier = {
  id: string;
  label: string;
  slot: PassSlot;
  unlockLevel: number;
  grantKind: 'level' | 'activity';
  activityKey?: string;
  activityNeed?: number;
};

export const PASS_TIERS: readonly PassTier[] = [
  { id: 'ribbon', label: 'Ribbon', slot: 'accent', unlockLevel: 2, grantKind: 'level' },
  { id: 'bow', label: 'Hair bow', slot: 'accessory', unlockLevel: 3, grantKind: 'level' },
  { id: 'black-shirt', label: 'Black shirt', slot: 'shirt', unlockLevel: 5, grantKind: 'level' },
  { id: 'sparkle-boots', label: 'Sparkly boots', slot: 'boots', unlockLevel: 7, grantKind: 'level' },
  { id: 'lantern-pin', label: 'Lantern pin', slot: 'pin', unlockLevel: 10, grantKind: 'level' },
  { id: 'flower-crown', label: 'Flower crown', slot: 'head', unlockLevel: 12, grantKind: 'level' },
  { id: 'heart-wand', label: 'Heart wand', slot: 'wand', unlockLevel: 15, grantKind: 'level' },
  { id: 'bunny', label: 'Bunny', slot: 'pet', unlockLevel: 20, grantKind: 'level' },
  { id: 'cat-ears', label: 'Cat ears', slot: 'head', unlockLevel: 25, grantKind: 'level' },
  { id: 'star-aura', label: 'Star aura', slot: 'aura', unlockLevel: 30, grantKind: 'level' },
  { id: 'tiara', label: 'Tiara', slot: 'head', unlockLevel: 35, grantKind: 'level' },
  { id: 'fairy-wings', label: 'Fairy wings', slot: 'wings', unlockLevel: 40, grantKind: 'level' },
  { id: 'pastel-frame', label: 'Pastel frame', slot: 'frame', unlockLevel: 45, grantKind: 'level' },
  { id: 'princess', label: 'Princess gown', slot: 'gown', unlockLevel: 50, grantKind: 'level' },
  { id: 'yoga-mat', label: 'Yoga mat', slot: 'accessory', unlockLevel: 1, grantKind: 'activity', activityKey: 'yoga', activityNeed: 5 },
  { id: 'bubble-aura', label: 'Bubble aura', slot: 'aura', unlockLevel: 1, grantKind: 'activity', activityKey: 'dishes', activityNeed: 10 },
];

export const COMPLETED_OPEN_KEY = 'la.companion.completedOpen';

export function completedOpenStorageKey(userId: string | null | undefined): string {
  return userId ? `${COMPLETED_OPEN_KEY}.${userId}` : COMPLETED_OPEN_KEY;
}

export function splitCompanionBoard<T extends { status: string }>(quests: readonly T[]): { open: T[]; done: T[] } {
  const open: T[] = [];
  const done: T[] = [];
  for (const quest of quests) {
    if (quest.status === 'declined') continue;
    if (quest.status === 'completed') done.push(quest);
    else open.push(quest);
  }
  return { open, done };
}

const GLYPHS: readonly [string, string][] = [
  ['yoga', '✿'],
  ['dish', '♡'],
  ['bowl', '★'],
  ['trash', '✦'],
  ['recycl', '❀'],
  ['clean', '✧'],
  ['party', '♥'],
  ['plate', '♥'],
  ['napkin', '♥'],
  ['cook', '✿'],
  ['dinner', '✿'],
];

export function questGlyph(title: string): string {
  const text = title.toLowerCase();
  for (const [needle, glyph] of GLYPHS) {
    if (text.includes(needle)) return glyph;
  }
  return '★';
}

export function nextLevelTier(items: readonly { id: string; owned: boolean; unlockLevel: number; grantKind?: string }[]): { id: string; unlockLevel: number } | null {
  const locked = items
    .filter((item) => !item.owned && item.grantKind !== 'activity')
    .sort((a, b) => a.unlockLevel - b.unlockLevel);
  return locked[0] ? { id: locked[0].id, unlockLevel: locked[0].unlockLevel } : null;
}
