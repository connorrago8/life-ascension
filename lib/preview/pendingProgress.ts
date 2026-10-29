/** Browser-only retry journal parser; no network calls or XP awards. */
export type PendingProgress = Readonly<{ id: string; delta: number }>;

/**
 * A pending request is authoritative for its request ID until its outcome is known.
 * Never silently discard malformed journal entries and mint a replacement ID.
 * Callers must pause saving and surface a storage/recovery error instead.
 */
export function parsePendingProgress(raw: string | null): PendingProgress | null {
  if (raw === null) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error('Unreadable pending progress journal');
  }
  if (!value || typeof value !== 'object'
    || !('id' in value) || typeof value.id !== 'string' || !value.id.trim()
    || !('delta' in value) || typeof value.delta !== 'number'
    || !Number.isSafeInteger(value.delta) || value.delta === 0) {
    throw new Error('Invalid pending progress journal');
  }
  return { id: value.id, delta: value.delta };
}

/** Reveal the collapsed Completed journal when an unresolved request needs recovery. */
export function hasPendingCompletedRecovery(
  instances: ReadonlyArray<{ id: string; status: string }>,
  readJournal: (key: string) => string | null,
): boolean {
  for (const instance of instances) {
    if (instance.status !== 'completed') continue;
    try {
      // Even malformed journals need a visible recovery/error path; never discard them.
      if (readJournal(`life-progress-pending:${instance.id}`) !== null) return true;
    } catch {
      return true;
    }
  }
  return false;
}

/** Reconcile server-confirmed completed retries with their quest metadata.
 * Include same-day archived quests, but never duplicate a completed card
 * already visible in Today's Journal. The caller must owner-scope DB reads.
 */
export function recoverableCompletedEntries<
  Q extends { id: string },
  I extends { id: string; quest_id: string; status: string },
>(
  instances: ReadonlyArray<I>,
  pendingInstanceIds: ReadonlyArray<string>,
  activeQuests: ReadonlyArray<Q>,
  archivedQuests: ReadonlyArray<Q>,
  shownCompletedIds: ReadonlyArray<string>,
): Array<{ quest: Q; instance: I }> {
  const pending = new Set(pendingInstanceIds);
  const shown = new Set(shownCompletedIds);
  const questById = new Map<string, Q>();
  for (const quest of [...activeQuests, ...archivedQuests]) questById.set(quest.id, quest);
  return instances.flatMap(instance => {
    if (instance.status !== 'completed' || !pending.has(instance.id) || shown.has(instance.id)) return [];
    const quest = questById.get(instance.quest_id);
    return quest ? [{ quest, instance }] : [];
  });
}

/** Find older pending instance IDs without scanning the user's entire quest history.
 * Returned IDs are only lookup hints: the server query MUST still filter owner_id.
 */
export function pendingProgressInstanceIds(
  storage: Pick<Storage, 'length' | 'key'>,
): string[] {
  const ids: string[] = [];
  try {
    for (let i = 0; i < storage.length && ids.length < 100; i++) {
      const key = storage.key(i);
      if (!key?.startsWith('life-progress-pending:')) continue;
      const id = key.slice('life-progress-pending:'.length);
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)
        && !ids.includes(id)) ids.push(id);
    }
  } catch {
    // Do not issue a broad fallback query when storage is unreadable.
    return [];
  }
  return ids;
}
