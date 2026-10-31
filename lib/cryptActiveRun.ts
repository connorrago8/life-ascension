/**
 * Keeps an unfinished Crypt delve in this browser so it survives a reload, the
 * Play tab, or leaving and coming back. The run itself stays a pure reducer
 * (lib/crypt/delve/run.ts never touches storage); the account layer saves the
 * latest state here after every change and resumes it on the next visit.
 *
 * A run is removed only when it ends (defeat or floor clear), when the player
 * confirms End run, or on sign-out. Runs are tied to their owner (the signed-in
 * user, the guest browser, or the dev preview), so one account never resumes
 * another's run. Nothing here grants XP, gear or vault items: loot claims stay
 * server-checked and idempotent per run and drop index.
 */
import type { DelvePhase, DelveState } from './crypt/delve/run';

export const ACTIVE_RUN_KEY = 'la.crypt.activeRun.v1';
/** Old runs are dropped after a day so a forgotten run never surprises anyone. */
export const ACTIVE_RUN_MAX_AGE_MS = 24 * 60 * 60 * 1000;

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>;
type Saved = { v: 1; owner: string; savedAt: number; state: DelveState };

const LIVE_PHASES: readonly DelvePhase[] = ['deck-select', 'start-pick', 'map', 'combat', 'reward', 'event', 'treasure', 'rest'];
const RUN_ID = /^[0-9a-f-]{8,64}$/i;

/** True while a run is in progress (not over). Over runs are never stored or resumed. */
export function isLiveRun(state: Pick<DelveState, 'phase'> | null | undefined): boolean {
  return !!state && LIVE_PHASES.includes(state.phase);
}

/** Who a stored run belongs to. Signed-in runs are keyed by user id. */
export function runOwner(mode: string, userId: string | null): string {
  return userId ? `user:${userId}` : mode === 'preview' ? 'preview' : 'guest';
}

function looksLikeRun(value: unknown): value is DelveState {
  if (!value || typeof value !== 'object') return false;
  const s = value as Partial<DelveState>;
  return typeof s.runId === 'string' && RUN_ID.test(s.runId)
    && isLiveRun(s as DelveState)
    && Number.isInteger(s.seed) && Number.isInteger(s.row) && Number.isFinite(s.hp) && Number.isFinite(s.maxHp)
    && Array.isArray(s.deck) && s.deck.length > 0 && Array.isArray(s.rows) && s.rows.length > 0
    && Array.isArray(s.path) && Array.isArray(s.found) && Array.isArray(s.startPick)
    && Number.isFinite(s.rng) && !!s.allocated && !!s.runBonus && !!s.loadout
    && (s.phase !== 'combat' || (!!s.battle && typeof s.battle === 'object'));
}

/** Save the latest state of a live run; an over (or empty) run clears the slot. */
export function saveActiveRun(storage: Storage, owner: string, state: DelveState | null, now: number): void {
  try {
    if (!isLiveRun(state)) {
      storage.removeItem(ACTIVE_RUN_KEY);
      return;
    }
    const saved: Saved = { v: 1, owner, savedAt: now, state: state as DelveState };
    storage.setItem(ACTIVE_RUN_KEY, JSON.stringify(saved));
  } catch {
    /* Private mode or full storage: the run still plays, it just can't resume. */
  }
}

/** The owner's unfinished run, or null. Bad, stale or someone else's records are ignored. */
export function loadActiveRun(storage: Storage, owner: string, now: number): DelveState | null {
  try {
    const raw = storage.getItem(ACTIVE_RUN_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Partial<Saved>;
    if (!saved || saved.v !== 1 || saved.owner !== owner) return null;
    if (!Number.isFinite(saved.savedAt) || now - (saved.savedAt as number) > ACTIVE_RUN_MAX_AGE_MS || (saved.savedAt as number) > now + 60_000) return null;
    return looksLikeRun(saved.state) ? saved.state : null;
  } catch {
    return null;
  }
}

export function clearActiveRun(storage: Storage): void {
  try {
    storage.removeItem(ACTIVE_RUN_KEY);
  } catch {
    /* nothing to clear */
  }
}

/** Browser storage, or null on the server / when blocked. */
export function browserStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}
