/**
 * One-time "Back from the Crypt" banner on Home. The delve writes a small
 * record when a run ends; Home shows it once, marks it seen, and the player
 * can dismiss it. Stored only in this browser (localStorage), keyed by run id.
 * It never equips gear and never changes XP or the vault.
 */
export const RETURN_KEY = 'la.crypt.return.v1';
export const RETURN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type ReturnRecord = {
  runId: string;
  result: 'conquered' | 'fallen';
  floor: number;
  /** Gear kept: confirmed vault saves (signed in) or found this visit (unsaved). */
  kept: number;
  mode: 'vault' | 'visit' | 'preview';
  endedAt: number;
  seen: boolean;
};

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem'>;

const RUN_ID = /^[0-9a-f-]{8,64}$/i;

export function parseReturn(raw: string | null): ReturnRecord | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<ReturnRecord>;
    if (!value || typeof value !== 'object') return null;
    if (typeof value.runId !== 'string' || !RUN_ID.test(value.runId)) return null;
    if (value.result !== 'conquered' && value.result !== 'fallen') return null;
    if (value.mode !== 'vault' && value.mode !== 'visit' && value.mode !== 'preview') return null;
    const floor = Number(value.floor);
    const kept = Number(value.kept);
    const endedAt = Number(value.endedAt);
    if (!Number.isInteger(floor) || floor < 1 || floor > 99) return null;
    if (!Number.isInteger(kept) || kept < 0 || kept > 999) return null;
    if (!Number.isFinite(endedAt)) return null;
    return { runId: value.runId, result: value.result, floor, kept, mode: value.mode, endedAt, seen: value.seen === true };
  } catch {
    return null;
  }
}

/** Save the end of a run. Re-saving the same run keeps it seen once it was shown. */
export function saveReturn(storage: Storage, record: Omit<ReturnRecord, 'seen'>): void {
  try {
    const current = parseReturn(storage.getItem(RETURN_KEY));
    const seen = current?.runId === record.runId ? current.seen : false;
    storage.setItem(RETURN_KEY, JSON.stringify({ ...record, seen }));
  } catch {
    /* Private mode or full storage: no banner, nothing else changes. */
  }
}

/** Read the banner for Home and mark it seen, so it shows once per run. */
export function takeReturnBanner(storage: Storage, now: number): ReturnRecord | null {
  try {
    const record = parseReturn(storage.getItem(RETURN_KEY));
    if (!record || record.seen) return null;
    if (now - record.endedAt > RETURN_MAX_AGE_MS || record.endedAt - now > 60_000) return null;
    storage.setItem(RETURN_KEY, JSON.stringify({ ...record, seen: true }));
    return record;
  } catch {
    return null;
  }
}

export function returnHeadline(record: Pick<ReturnRecord, 'result' | 'floor' | 'kept' | 'mode'>): string {
  const outcome = record.result === 'conquered' ? `Floor ${record.floor} conquered` : 'The road continues';
  const items = record.kept === 0 ? 'no items' : `${record.kept} item${record.kept === 1 ? '' : 's'}`;
  return `Back from the Crypt: ${outcome} · ${items} ${record.mode === 'vault' ? 'kept' : 'found'}`;
}

export function returnDetail(record: Pick<ReturnRecord, 'mode'>): string {
  if (record.mode === 'vault') return 'Saved to your vault. Nothing is worn automatically; tap Wear at camp.';
  if (record.mode === 'visit') return 'That run wasn\u2019t saved to your account.';
  return 'Preview run: not saved to your account.';
}

/** Browser entry point used by the delve when a run ends. Stores only the banner fields above (no gear ids, nothing worn). */
export function recordRunEnd(record: Omit<ReturnRecord, 'seen'>): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    saveReturn(window.localStorage, record);
  } catch {
    /* Storage unavailable: no banner. */
  }
}
