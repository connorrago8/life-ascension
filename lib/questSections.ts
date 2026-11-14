export const QUEST_SECTION_KEY = 'la.quest.sections';

export type QuestSectionId = 'today' | 'week' | 'upcoming' | 'completed';

export function readSectionOpen(id: string, fallback: boolean, storage: Pick<Storage, 'getItem'> | null): boolean {
  if (!storage) return fallback;
  try {
    const raw = storage.getItem(QUEST_SECTION_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed[id] === true || parsed[id] === false) return parsed[id];
  } catch { /* A bad value falls back to the default for that section. */ }
  return fallback;
}

export function writeSectionOpen(id: string, open: boolean, storage: Pick<Storage, 'getItem' | 'setItem'>): void {
  let current: Record<string, boolean> = {};
  try {
    const raw = storage.getItem(QUEST_SECTION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      for (const [key, value] of Object.entries(parsed)) {
        if (value === true || value === false) current[key] = value;
      }
    }
  } catch { current = {}; }
  current[id] = open;
  storage.setItem(QUEST_SECTION_KEY, JSON.stringify(current));
}
