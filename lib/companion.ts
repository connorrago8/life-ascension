/** Curated companion titles. The SQL check constraint must list the same values. */
export const COMPANION_TITLES = [
  'Lantern Keeper',
  'Hearth Warden',
  'Pathfinder',
  'Storyweaver',
  'Dawn Herald',
] as const;

export const COMPANION_COLORS = ['amber', 'rose', 'sage', 'sky', 'violet'] as const;

export type CompanionColor = (typeof COMPANION_COLORS)[number];

export type CompanionTitle = (typeof COMPANION_TITLES)[number];

export function isCompanionTitle(value: string): value is CompanionTitle {
  return (COMPANION_TITLES as readonly string[]).includes(value);
}
