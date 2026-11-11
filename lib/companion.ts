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

export function companionStatusLabel(status: string): string {
  if (status === 'completed') return 'Done';
  if (status === 'accepted' || status === 'sent') return 'On his board';
  return status;
}

export function collapseCompanionQuests<T extends { title: string; dueOn: string | null; instanceId?: string | null }>(quests: readonly T[]): T[] {
  const seen = new Set<string>();
  const rows: T[] = [];
  for (const quest of quests) {
    const key = quest.instanceId || `${quest.title.trim().toLowerCase()}|${quest.dueOn ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(quest);
  }
  return rows;
}
