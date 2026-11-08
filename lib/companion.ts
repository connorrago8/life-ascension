/** Curated companion titles. The SQL check constraint must list the same values. */
export const COMPANION_TITLES = [
  'Lantern Keeper',
  'Hearth Warden',
  'Pathfinder',
  'Storyweaver',
  'Dawn Herald',
] as const;

export type CompanionTitle = (typeof COMPANION_TITLES)[number];

export function isCompanionTitle(value: string): value is CompanionTitle {
  return (COMPANION_TITLES as readonly string[]).includes(value);
}
