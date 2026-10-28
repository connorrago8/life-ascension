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
