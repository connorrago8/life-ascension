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
  description?: string;
  slot: PassSlot;
  unlockLevel: number;
  grantKind: 'level' | 'activity';
  activityKey?: string;
  activityNeed?: number;
};

export const PASS_TIERS: readonly PassTier[] = [
  // Streetborn (L2–L20). IDs stay stable so owned and worn rows survive the rename.
  { id: 'fingerless-gloves', label: 'Nightgrip Gloves', description: 'Fingerless black gloves worn by the city’s wanderers.', slot: 'gloves', unlockLevel: 2, grantKind: 'level' },
  { id: 'nose-ring', label: 'Silver Thorn', description: 'A delicate silver nose ring with a rebellious edge.', slot: 'face', unlockLevel: 4, grantKind: 'level' },
  { id: 'cargo-pants', label: 'Shadow Cargo', description: 'Dark utility pants with reinforced pockets.', slot: 'bottom', unlockLevel: 6, grantKind: 'level' },
  { id: 'crop-top', label: 'Midnight Crop', description: 'A fitted black top made for movement.', slot: 'top', unlockLevel: 8, grantKind: 'level' },
  { id: 'leather-jacket', label: 'Rogue’s Leather', description: 'A cropped jacket, weathered by countless nights.', slot: 'jacket', unlockLevel: 10, grantKind: 'level' },
  { id: 'wrist-tattoo', label: 'First Mark', description: 'A small wrist tattoo marking the beginning of her journey.', slot: 'tattoo', unlockLevel: 12, grantKind: 'level' },
  { id: 'combat-boots', label: 'Ironstep Boots', description: 'Buckled combat boots with scarred leather.', slot: 'boots', unlockLevel: 14, grantKind: 'level' },
  { id: 'silver-circlet', label: 'Moonsteel Circlet', description: 'A slender silver crown for an emerging legend.', slot: 'head', unlockLevel: 16, grantKind: 'level' },
  { id: 'neon-hair-streak', label: 'Neon Rebellion', description: 'A vivid streak of color woven through her hair.', slot: 'hair', unlockLevel: 18, grantKind: 'level' },
  { id: 'arm-sleeve-tattoo', label: 'Azure Serpent', description: 'A luminous cyan tattoo wrapping around her arm.', slot: 'tattoo', unlockLevel: 20, grantKind: 'level' },

  // Neon Arcanist (L22–L40)
  { id: 'utility-belt', label: 'Wanderer’s Rig', description: 'A utility belt fitted with mysterious equipment.', slot: 'hip', unlockLevel: 22, grantKind: 'level' },
  { id: 'cyber-visor', label: 'Spectral Sight', description: 'A cybernetic visor with a cold blue glow.', slot: 'face', unlockLevel: 24, grantKind: 'level' },
  { id: 'trench-coat', label: 'Nightfall Trench', description: 'A long dark coat that moves like a shadow.', slot: 'jacket', unlockLevel: 26, grantKind: 'level' },
  { id: 'neck-tattoo', label: 'Magenta Oath', description: 'A glowing rune tattoo along her neck.', slot: 'tattoo', unlockLevel: 28, grantKind: 'level' },
  { id: 'nightcat-headset', label: 'Nightcat Headset', description: 'Black cat-ear audio gear with subtle illuminated edges.', slot: 'head', unlockLevel: 30, grantKind: 'level' },
  { id: 'rune-lantern', label: 'Runebearer’s Lantern', description: 'An ancient lantern containing a synthetic flame.', slot: 'back', unlockLevel: 32, grantKind: 'level' },
  { id: 'armored-corset', label: 'Arcsteel Corset', description: 'Reinforced leather armor with elegant metal detailing.', slot: 'top', unlockLevel: 34, grantKind: 'level' },
  { id: 'hand-tattoos', label: 'Spellbound Hands', description: 'Glowing sigils etched across both hands.', slot: 'tattoo', unlockLevel: 36, grantKind: 'level' },
  { id: 'hooded-cloak', label: 'Eclipse Mantle', description: 'A hooded cloak threaded with faint neon light.', slot: 'jacket', unlockLevel: 38, grantKind: 'level' },
  { id: 'rune-drone', label: 'Wisp Drone', description: 'A floating rune-powered mechanical companion.', slot: 'companion', unlockLevel: 40, grantKind: 'level' },

  // Obsidian Sovereign (L42–L50)
  { id: 'shoulder-pauldron', label: 'Obsidian Guard', description: 'A dark shoulder pauldron with engraved gold details.', slot: 'back', unlockLevel: 42, grantKind: 'level' },
  { id: 'back-tattoo', label: 'Sovereign’s Ink', description: 'An elaborate full-back tattoo of arcane circuitry.', slot: 'tattoo', unlockLevel: 44, grantKind: 'level' },
  { id: 'silver-neon-hair', label: 'Ghostsilver Hair', description: 'Silver hair with luminous neon tips.', slot: 'hair', unlockLevel: 46, grantKind: 'level' },
  { id: 'neon-aura', label: 'Astral Veil', description: 'A restrained magenta-cyan aura surrounding her silhouette.', slot: 'aura', unlockLevel: 48, grantKind: 'level' },
  { id: 'obsidian-gown', label: 'Obsidian Empress', description: 'A black techwear gown adorned with aged-gold filigree.', slot: 'top', unlockLevel: 50, grantKind: 'level' },

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
