export const QUEST_AREAS = [
  { id: 'life', label: 'Life', description: 'Home, health & everyday tasks', icon: '◈' },
  { id: 'izzy', label: 'Izzy', description: 'Tasks from your partner', icon: '♡' },
  { id: 'work', label: 'Work', description: 'Pharmacy & career tasks', icon: '▣' },
  { id: 'together', label: 'Together', description: 'Shared plans & activities', icon: '✦' },
] as const;
export type QuestArea = (typeof QUEST_AREAS)[number]['id'];
export type QuestView = 'today' | 'week' | 'later' | 'done';
export function parseQuestArea(value: unknown): QuestArea {
  return QUEST_AREAS.some(area => area.id === value) ? value as QuestArea : 'life';
}
export function parseQuestView(value: unknown): QuestView {
  return ['today', 'week', 'later', 'done'].includes(String(value)) ? value as QuestView : 'today';
}
/** Source takes precedence over domain: a work request from Izzy stays in Izzy. */
export function taskArea(quest: {id: string; domain: string}, partnerQuestIds: ReadonlySet<string>): Exclude<QuestArea, 'together'> {
  if (partnerQuestIds.has(quest.id)) return 'izzy';
  return quest.domain === 'career' ? 'work' : 'life';
}
export function questWorkspaceHref(area: QuestArea, view: QuestView = 'today'): string {
  return `/quests?area=${area}&view=${view}`;
}
/** Retryable saves must never disappear behind pagination. */
export function prioritizePending<T extends {instance?: {id: string}}>(rows: readonly T[], recoveryIds: readonly string[], limit: number): T[] {
  const pending = new Set(recoveryIds);
  return [...rows.filter(row=>row.instance&&pending.has(row.instance.id)), ...rows.filter(row=>!row.instance||!pending.has(row.instance.id)).slice(0,Math.max(0,limit))];
}
