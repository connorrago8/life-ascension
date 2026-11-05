/**
 * A completion that never reached the server. The card shows Retry and must
 * not show a done tick or change XP until the ledger receipt succeeds.
 */
const KEY = 'life-ascension:quest-complete-pending:v1';

type PendingMap = Record<string, string[]>;

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function readMap(store: Storage): PendingMap {
  try {
    const parsed = JSON.parse(store.getItem(KEY) || '{}') as PendingMap;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function pendingCompletes(owner: string, store: Storage | null = storage()): string[] {
  if (!owner || !store) return [];
  const ids = readMap(store)[owner];
  return Array.isArray(ids) ? ids.filter((id) => typeof id === 'string' && id.length > 0) : [];
}

export function rememberPendingComplete(owner: string, instanceId: string, store: Storage | null = storage()): void {
  if (!owner || !instanceId || !store) return;
  const map = readMap(store);
  const ids = new Set(pendingCompletes(owner, store));
  ids.add(instanceId);
  map[owner] = [...ids];
  try { store.setItem(KEY, JSON.stringify(map)); } catch { /* retry stays in memory */ }
}

export function forgetPendingComplete(owner: string, instanceId: string, store: Storage | null = storage()): void {
  if (!owner || !store) return;
  const map = readMap(store);
  map[owner] = pendingCompletes(owner, store).filter((id) => id !== instanceId);
  try { store.setItem(KEY, JSON.stringify(map)); } catch { /* the button can still clear on the next load */ }
}
