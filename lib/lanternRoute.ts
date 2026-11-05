/** Device-local Lantern Route. It never writes XP, items, or streaks. */
export const LANTERN_STORAGE_KEY = 'life-ascension:lantern-route:v1';
export const LANTERN_STOPS = ['hearth', 'forge', 'market'] as const;
export type LanternStop = (typeof LANTERN_STOPS)[number];

export type LanternProgress = {
  started: boolean;
  clues: LanternStop[];
  placed: LanternStop[];
  solved: boolean;
  /** Stays true after the first solve so Reset can replay the story without putting the lantern out. */
  kept: boolean;
};

export const EMPTY_LANTERN: LanternProgress = { started: false, clues: [], placed: [], solved: false, kept: false };

export const LANTERN_PURPOSE = 'A short town story. Find 3 clues, then put them in order.';
export const LANTERN_RESET_COPY = 'Reset starts the clues over. The lit lantern stays. XP, items, and streaks do not change.';
export const LANTERN_SAVED_COPY = 'Progress is saved on this device and kept when you leave or reload.';

function stops(value: unknown): LanternStop[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<LanternStop>();
  for (const entry of value) {
    if (LANTERN_STOPS.includes(entry as LanternStop)) seen.add(entry as LanternStop);
  }
  return [...seen];
}

export function parseLanternProgress(raw: string | null): LanternProgress {
  if (!raw) return { ...EMPTY_LANTERN };
  try {
    const parsed = JSON.parse(raw) as Partial<LanternProgress>;
    const clues = stops(parsed.clues);
    const placed = stops(parsed.placed).filter((stop) => clues.includes(stop));
    const solved = parsed.solved === true && clues.length === 3;
    const kept = parsed.kept === true || solved;
    return { started: parsed.started === true || clues.length > 0 || solved, clues, placed: solved ? placed : placed, solved, kept };
  } catch {
    return { ...EMPTY_LANTERN };
  }
}

export function readLanternProgress(store: Pick<Storage, 'getItem'> | null): LanternProgress {
  if (!store) return { ...EMPTY_LANTERN };
  try {
    return parseLanternProgress(store.getItem(LANTERN_STORAGE_KEY));
  } catch {
    return { ...EMPTY_LANTERN };
  }
}

export function writeLanternProgress(store: Pick<Storage, 'setItem'> | null, progress: LanternProgress): boolean {
  if (!store) return false;
  try {
    store.setItem(LANTERN_STORAGE_KEY, JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}

export function lanternClueCount(progress: LanternProgress): number {
  return progress.clues.length;
}

/** Acquire storage inside the guard: browsers can throw before getItem is called. */
export function loadLanternVisit(getStore: () => Pick<Storage, 'getItem'> | null): { progress: LanternProgress; readable: boolean } {
  try {
    const store = getStore();
    if (!store) return { progress: { ...EMPTY_LANTERN }, readable: false };
    return { progress: parseLanternProgress(store.getItem(LANTERN_STORAGE_KEY)), readable: true };
  } catch {
    return { progress: { ...EMPTY_LANTERN }, readable: false };
  }
}

export function saveLanternVisit(getStore: () => Pick<Storage, 'setItem'> | null, progress: LanternProgress): boolean {
  try {
    return writeLanternProgress(getStore(), progress);
  } catch {
    return false;
  }
}
