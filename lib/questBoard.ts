export type QuestClass = 'main' | 'side';
export type HighlightCandidate = {
  id: string; dueDate: string; createdAt: string; classification?: QuestClass;
  status: 'available' | 'completed' | 'deferred'; eligible: boolean;
};
export type HighlightSnapshot = { version: 1; ownerId: string; day: string; ids: string[] };
export type HighlightStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function chicagoDay(value: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(value);
}

/** IDs identify occurrences, never quest templates. Completion does not refill the set. */
export function dailyHighlights(storage: HighlightStorage, ownerId: string, day: string,
  candidates: HighlightCandidate[]): HighlightSnapshot {
  const key = `life-ascension:highlights:v1:${ownerId}:${day}`;
  const raw = storage.getItem(key);
  if (raw !== null) {
    // Fail closed on corruption: silently regenerating could refill completed slots.
    const saved = JSON.parse(raw) as HighlightSnapshot;
    if (saved.version !== 1 || saved.ownerId !== ownerId || saved.day !== day ||
      !Array.isArray(saved.ids) || saved.ids.length > 3 ||
      saved.ids.some(id => typeof id !== 'string' || !id) || new Set(saved.ids).size !== saved.ids.length) {
      throw new Error('Daily selection could not be restored');
    }
    return saved;
  }
  const ids = [...candidates].filter(c => c.eligible && c.status === 'available' && c.dueDate <= day)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) ||
      Number(b.classification === 'main') - Number(a.classification === 'main') ||
      a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
    .map(c => c.id).filter((id, index, all) => all.indexOf(id) === index).slice(0, 3);
  const saved: HighlightSnapshot = { version: 1, ownerId, day, ids };
  storage.setItem(key, JSON.stringify(saved));
  return saved;
}

export type JournalOccurrence = { id: string; completed_at: string; title: string; xp: number | null };
export function groupJournal(rows: JournalOccurrence[]): { day: string; entries: JournalOccurrence[] }[] {
  const groups = new Map<string, JournalOccurrence[]>();
  const unique = new Map(rows.map(row => [row.id, row]));
  for (const row of [...unique.values()].sort((a, b) => b.completed_at.localeCompare(a.completed_at) || a.id.localeCompare(b.id))) {
    if (!Number.isFinite(Date.parse(row.completed_at))) continue;
    const day = chicagoDay(new Date(row.completed_at));
    groups.set(day, [...(groups.get(day) ?? []), row]);
  }
  return [...groups].map(([day, entries]) => ({ day, entries }));
}
