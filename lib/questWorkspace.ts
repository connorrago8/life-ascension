export const QUEST_CHIPS = [
  { id: 'all', label: 'All' },
  { id: 'life', label: 'Life' },
  { id: 'partner', label: 'Partner' },
  { id: 'sent', label: 'Sent' },
  { id: 'work', label: 'Work' },
  { id: 'together', label: 'Together' },
] as const;

export type QuestChip = (typeof QUEST_CHIPS)[number]['id'];
export type QuestArea = 'life' | 'izzy' | 'work' | 'together';
export type QuestView = 'today' | 'week' | 'later' | 'done';

export function partnerChipLabel(companion: boolean): string {
  return companion ? 'From Connor' : 'From Izzy';
}

export function chipLabel(chip: QuestChip, companion: boolean): string {
  if (chip === 'partner') return partnerChipLabel(companion);
  return QUEST_CHIPS.find((item) => item.id === chip)?.label ?? 'All';
}

/** Legacy area links (`izzy`) land on the partner chip. Unknown values stay on All. */
export function parseQuestChip(value: unknown): QuestChip {
  if (value === 'izzy' || value === 'partner') return 'partner';
  if (value === 'all' || value === 'life' || value === 'work' || value === 'together' || value === 'sent') return value;
  return 'all';
}

export function parseQuestArea(value: unknown): QuestArea {
  if (value === 'izzy' || value === 'work' || value === 'together' || value === 'life') return value;
  return 'life';
}

export function parseQuestView(value: unknown): QuestView {
  return value === 'week' || value === 'later' || value === 'done' ? value : 'today';
}

/** Source takes precedence over domain: a work request from a partner stays with the partner. */
export function taskArea(quest: { id: string; domain: string }, partnerQuestIds: ReadonlySet<string>): Exclude<QuestArea, 'together'> {
  if (partnerQuestIds.has(quest.id)) return 'izzy';
  return quest.domain === 'career' ? 'work' : 'life';
}

export function matchesChip(area: Exclude<QuestArea, 'together'>, chip: QuestChip): boolean {
  if (chip === 'together') return false;
  if (chip === 'all') return true;
  if (chip === 'partner') return area === 'izzy';
  return area === chip;
}

export function questWorkspaceHref(chip: QuestChip = 'all'): string {
  return chip === 'all' ? '/quests' : `/quests?chip=${chip}`;
}

export function questDetailChip(chip: QuestChip): string {
  return chip === 'all' ? '' : `?chip=${chip}`;
}

/** Retryable saves must never disappear behind a short list. */
export function prioritizePending<T extends { instance?: { id: string } }>(rows: readonly T[], recoveryIds: readonly string[], limit: number): T[] {
  const pending = new Set(recoveryIds);
  return [...rows.filter((row) => row.instance && pending.has(row.instance.id)), ...rows.filter((row) => !row.instance || !pending.has(row.instance.id)).slice(0, Math.max(0, limit))];
}
