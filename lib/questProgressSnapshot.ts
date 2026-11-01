/**
 * Last server-confirmed quest board, cached on this device so navigation and a
 * refresh do not flash an empty board. The server ledger remains the authority.
 * The cache is keyed by account and is never shown for a different sign-in.
 */
export type QuestProgressSnapshot = {
  owner: string;
  xp: number;
  quests: any[];
  instances: any[];
  streak: { owner: string; state: Record<string, { fire: number; doneToday: boolean; today: string; timeZone: string } | null> } | null;
};

const KEY = 'life-ascension:quest-progress:v1';

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function readQuestProgress(owner: string, store: Storage | null = storage()): QuestProgressSnapshot | null {
  if (!owner || !store) return null;
  try {
    const parsed = JSON.parse(store.getItem(KEY) || 'null') as QuestProgressSnapshot | null;
    if (!parsed || parsed.owner !== owner || !Number.isSafeInteger(parsed.xp) || parsed.xp < 0) return null;
    if (!Array.isArray(parsed.quests) || !Array.isArray(parsed.instances)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeQuestProgress(snapshot: QuestProgressSnapshot, store: Storage | null = storage()): void {
  if (!store || !snapshot.owner || !Number.isSafeInteger(snapshot.xp) || snapshot.xp < 0) return;
  try {
    store.setItem(KEY, JSON.stringify(snapshot));
  } catch {
    /* Storage can be full or denied. The server copy is unchanged. */
  }
}

export type HomeSnapshot = {
  owner: string;
  name: string;
  xp: number;
  stats: Record<string, unknown> | null;
  gear: unknown;
  today: { left: number; done: number } | null;
  streak: { questsOnStreak: number } | null;
};

const HOME_KEY = 'life-ascension:home-progress:v1';

export function readHomeProgress(owner: string, store: Storage | null = storage()): HomeSnapshot | null {
  if (!owner || !store) return null;
  try {
    const parsed = JSON.parse(store.getItem(HOME_KEY) || 'null') as HomeSnapshot | null;
    if (!parsed || parsed.owner !== owner || !Number.isSafeInteger(parsed.xp) || parsed.xp < 0) return null;
    if (typeof parsed.name !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeHomeProgress(snapshot: HomeSnapshot, store: Storage | null = storage()): void {
  if (!store || !snapshot.owner) return;
  try {
    store.setItem(HOME_KEY, JSON.stringify(snapshot));
  } catch {
    /* The next successful load will try again. */
  }
}
