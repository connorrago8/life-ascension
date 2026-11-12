/** Cosmetic battle pass. Levels follow lib/level.ts. The server grants rows; this list is the art and the order.
 * Approved Style Track: Baldur’s Gate 3 × dark cyberpunk. Adult proportions. Nothing auto-equips.
 * Level 1 default (not an unlock): plain white tank, baggy brown pants, scuffed boots.
 */

export type PassSlot =
  | 'top'
  | 'bottom'
  | 'boots'
  | 'gloves'
  | 'jacket'
  | 'head'
  | 'face'
  | 'hair'
  | 'tattoo'
  | 'hip'
  | 'aura'
  | 'companion'
  | 'back'
  | 'accessory';

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
  // Street basics (L2–L10)
  { id: 'fingerless-gloves', label: 'Black fingerless gloves', slot: 'gloves', unlockLevel: 2, grantKind: 'level' },
  { id: 'nose-ring', label: 'Silver nose ring', slot: 'face', unlockLevel: 4, grantKind: 'level' },
  { id: 'cargo-pants', label: 'Black cargo pants', slot: 'bottom', unlockLevel: 6, grantKind: 'level' },
  { id: 'crop-top', label: 'Black crop top', slot: 'top', unlockLevel: 8, grantKind: 'level' },
  { id: 'leather-jacket', label: 'Cropped leather jacket', slot: 'jacket', unlockLevel: 10, grantKind: 'level' },

  // Ink & edge (L12–L20)
  { id: 'wrist-tattoo', label: 'Small wrist tattoo', slot: 'tattoo', unlockLevel: 12, grantKind: 'level' },
  { id: 'combat-boots', label: 'Buckled combat boots', slot: 'boots', unlockLevel: 14, grantKind: 'level' },
  { id: 'silver-circlet', label: 'Silver circlet', slot: 'head', unlockLevel: 16, grantKind: 'level' },
  { id: 'neon-hair-streak', label: 'Neon hair streak', slot: 'hair', unlockLevel: 18, grantKind: 'level' },
  { id: 'arm-sleeve-tattoo', label: 'Glowing cyan arm-sleeve tattoo', slot: 'tattoo', unlockLevel: 20, grantKind: 'level' },

  // Techwear (L22–L30)
  { id: 'utility-belt', label: 'Utility belt', slot: 'hip', unlockLevel: 22, grantKind: 'level' },
  { id: 'cyber-visor', label: 'Cyber eye visor', slot: 'face', unlockLevel: 24, grantKind: 'level' },
  { id: 'trench-coat', label: 'Long dark trench coat', slot: 'jacket', unlockLevel: 26, grantKind: 'level' },
  { id: 'neck-tattoo', label: 'Glowing magenta neck tattoo', slot: 'tattoo', unlockLevel: 28, grantKind: 'level' },

  // Arcane cyberpunk (L32–L40). Cat-ear headset stays out until the founder confirms it.
  { id: 'rune-lantern', label: 'Rune lantern', slot: 'back', unlockLevel: 32, grantKind: 'level' },
  { id: 'armored-corset', label: 'Armored leather corset', slot: 'top', unlockLevel: 34, grantKind: 'level' },
  { id: 'hand-tattoos', label: 'Glowing hand tattoos', slot: 'tattoo', unlockLevel: 36, grantKind: 'level' },
  { id: 'hooded-cloak', label: 'Hooded cloak with neon trim', slot: 'jacket', unlockLevel: 38, grantKind: 'level' },
  { id: 'rune-drone', label: 'Floating rune drone', slot: 'companion', unlockLevel: 40, grantKind: 'level' },

  // Legendary (L42–L50)
  { id: 'shoulder-pauldron', label: 'Obsidian shoulder pauldron', slot: 'back', unlockLevel: 42, grantKind: 'level' },
  { id: 'back-tattoo', label: 'Full back tattoo', slot: 'tattoo', unlockLevel: 44, grantKind: 'level' },
  { id: 'silver-neon-hair', label: 'Silver hair with neon tips', slot: 'hair', unlockLevel: 46, grantKind: 'level' },
  { id: 'neon-aura', label: 'Soft neon aura', slot: 'aura', unlockLevel: 48, grantKind: 'level' },
  { id: 'obsidian-gown', label: 'Obsidian techwear gown with gold filigree', slot: 'top', unlockLevel: 50, grantKind: 'level' },

  // Activity drops (re-themed)
  { id: 'neon-yoga-wrap', label: 'Neon yoga wrap', slot: 'accessory', unlockLevel: 1, grantKind: 'activity', activityKey: 'yoga', activityNeed: 5 },
  { id: 'rune-cleaning-drone', label: 'Rune cleaning drone', slot: 'companion', unlockLevel: 1, grantKind: 'activity', activityKey: 'dishes', activityNeed: 10 },
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
  ['yoga', '✦'],
  ['dish', '⚔'],
  ['bowl', '★'],
  ['trash', '✦'],
  ['recycl', '⚔'],
  ['clean', '✦'],
  ['party', '★'],
  ['plate', '⚔'],
  ['napkin', '✦'],
  ['cook', '★'],
  ['dinner', '★'],
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
