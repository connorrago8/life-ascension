/** Cosmetic display titles. Not stats and not the account name.
 * Between milestones, the most recently earned title stays up.
 */

const STEPS = [1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50] as const;

const TITLES = {
  connor: {
    1: 'The Unmarked',
    5: 'Ember Walker',
    10: 'Ashbound Wanderer',
    15: 'Iron Wayfinder',
    20: 'Rift Initiate',
    25: 'Shadow Pathfinder',
    30: 'Voidrunner',
    35: 'Rune Warden',
    40: 'Rift Sentinel',
    45: 'Obsidian Vanguard',
    50: 'The Ascendant',
  },
  izzy: {
    1: 'The Unwritten',
    5: 'Streetborn',
    10: 'Night Rogue',
    15: 'Silver Thorn',
    20: 'Azure Marked',
    25: 'Neon Drifter',
    30: 'Nightcat Operative',
    35: 'Arcsteel Adept',
    40: 'Wisp Arcanist',
    45: 'Obsidian Heiress',
    50: 'Obsidian Sovereign',
  },
} as const;

export type TitleBearer = keyof typeof TITLES;

export function cosmeticTitle(level: number, who: TitleBearer): string {
  const current = Number.isFinite(level) ? Math.floor(level) : 1;
  let earned: (typeof STEPS)[number] = 1;
  for (const step of STEPS) {
    if (current >= step) earned = step;
  }
  return TITLES[who][earned];
}
