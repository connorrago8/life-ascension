import { localParts, QUEST_TIME_ZONE } from './questStreak.ts';

/**
 * Quest-level home decorations. Level comes from lifetime quest XP (lib/level.ts).
 * These tiers change the picture only. They do not grant stats, XP, or combat power.
 */
export type HomeTier = {
  level: number;
  id: string;
  label: string;
  rooms: number;
  garden: boolean;
  banner: boolean;
};

export const HOME_TIERS: readonly HomeTier[] = [
  { level: 1, id: 'cottage', label: 'Cottage', rooms: 1, garden: false, banner: false },
  { level: 3, id: 'hearth', label: 'Hearth room', rooms: 2, garden: false, banner: false },
  { level: 5, id: 'yard', label: 'Training yard', rooms: 2, garden: true, banner: false },
  { level: 8, id: 'hall', label: 'Armory hall', rooms: 3, garden: true, banner: true },
  { level: 12, id: 'keep', label: 'Little keep', rooms: 4, garden: true, banner: true },
];

export function homeTierForLevel(level: number): HomeTier {
  const current = Math.max(1, Math.floor(level) || 1);
  let tier = HOME_TIERS[0];
  for (const entry of HOME_TIERS) {
    if (current >= entry.level) tier = entry;
  }
  return tier;
}

/** Chicago clock. Night is 7:00 PM until the 5:00 AM game-day start. */
export function homeSky(now: Date = new Date()): 'day' | 'night' {
  const { minutes } = localParts(now, QUEST_TIME_ZONE);
  return minutes >= 19 * 60 || minutes < 5 * 60 ? 'night' : 'day';
}

/** Sound stays off unless the player opts in. There is no audio file in this release. */
export const HUB_SOUND_KEY = 'la.hub.sound';

export function hubSoundsEnabled(read: (key: string) => string | null): boolean {
  return read(HUB_SOUND_KEY) === 'on';
}

export function playHubCue(read: (key: string) => string | null, _cue: 'unlock'): void {
  if (!hubSoundsEnabled(read)) return;
}
