/** Adventurer (Connor) cosmetic track.
 * Matches Izzy's cadence (every 2 levels through L50) but different pieces.
 * Purely cosmetic. Does not touch Crypt XP or Ashen Hood.
 */

export type AdventurerSlot =
  | 'head'
  | 'chest'
  | 'shoulders'
  | 'hands'
  | 'legs'
  | 'feet'
  | 'back'
  | 'waist'
  | 'face'
  | 'aura';

export type AdventurerCosmetic = {
  id: string;
  label: string;
  slot: AdventurerSlot;
  unlockLevel: number;
};

export const ADVENTURER_COSMETICS: readonly AdventurerCosmetic[] = [
  { id: 'shadow-hood', label: 'Shadow hood', slot: 'head', unlockLevel: 2 },
  { id: 'leather-bracers', label: 'Worn leather bracers', slot: 'hands', unlockLevel: 4 },
  { id: 'dark-tunic', label: 'Dark traveler tunic', slot: 'chest', unlockLevel: 6 },
  { id: 'road-boots', label: 'Road-worn boots', slot: 'feet', unlockLevel: 8 },
  { id: 'pathfinder-cloak', label: 'Pathfinder cloak', slot: 'back', unlockLevel: 10 },
  { id: 'rune-belt', label: 'Rune-etched belt', slot: 'waist', unlockLevel: 12 },
  { id: 'iron-pauldrons', label: 'Iron pauldrons', slot: 'shoulders', unlockLevel: 14 },
  { id: 'scarred-gloves', label: 'Scarred gloves', slot: 'hands', unlockLevel: 16 },
  { id: 'traveler-pants', label: 'Reinforced traveler pants', slot: 'legs', unlockLevel: 18 },
  { id: 'ember-circlet', label: 'Ember circlet', slot: 'head', unlockLevel: 20 },
  { id: 'void-gauntlets', label: 'Void-touched gauntlets', slot: 'hands', unlockLevel: 22 },
  { id: 'storm-cape', label: 'Storm cape', slot: 'back', unlockLevel: 24 },
  { id: 'obsidian-vest', label: 'Obsidian vest', slot: 'chest', unlockLevel: 26 },
  { id: 'neon-edge-bracers', label: 'Neon-edge bracers', slot: 'hands', unlockLevel: 28 },
  { id: 'warden-boots', label: 'Warden boots', slot: 'feet', unlockLevel: 30 },
  { id: 'arcane-shoulders', label: 'Arcane shoulders', slot: 'shoulders', unlockLevel: 32 },
  { id: 'silver-mask', label: 'Silver half-mask', slot: 'face', unlockLevel: 34 },
  { id: 'longcoat', label: 'Dark longcoat', slot: 'chest', unlockLevel: 36 },
  { id: 'rune-lantern-pack', label: 'Rune lantern pack', slot: 'back', unlockLevel: 38 },
  { id: 'void-aura', label: 'Soft void aura', slot: 'aura', unlockLevel: 40 },
  { id: 'gold-filigree-armor', label: 'Gold filigree armor', slot: 'chest', unlockLevel: 42 },
  { id: 'neon-trim-cloak', label: 'Neon-trim cloak', slot: 'back', unlockLevel: 44 },
  { id: 'cyber-visor', label: 'Cyber visor', slot: 'face', unlockLevel: 46 },
  { id: 'obsidian-pauldrons', label: 'Obsidian pauldrons', slot: 'shoulders', unlockLevel: 48 },
  { id: 'legendary-coat', label: 'Legendary wayfarer coat', slot: 'chest', unlockLevel: 50 },
];
