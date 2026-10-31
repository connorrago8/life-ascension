import { ENCOUNTERS_PER_RUN, FLOOR_ROWS } from './floor.ts';
import type { DelveState } from './run.ts';

/**
 * End-of-run summary. Built only from fields the run already tracks (phase,
 * floor, path, found, reward, battle foe). No invented stats: no damage
 * totals, turns or timings. Display only; it never equips anything.
 */
export type RunRecap = {
  runId: string;
  result: 'conquered' | 'fallen';
  floor: number;
  /** Rooms finished this run (the boss counts as a room). */
  roomsCleared: number;
  /** Rooms entered this run, including the one you fell in. */
  roomsVisited: number;
  roomsTotal: number;
  /** Who ended a lost run, if it ended in a fight. */
  fellTo: string | null;
  /** The boss drop on a conquered floor. */
  bossReward: string | null;
  /** Every gear id found this run, in drop order. */
  found: string[];
};

export type SaveMode = 'vault' | 'visit' | 'preview';

export const RECAP_FIELDS = ['runId', 'result', 'floor', 'roomsCleared', 'roomsVisited', 'roomsTotal', 'fellTo', 'bossReward', 'found'] as const;

type RecapInput = Pick<DelveState, 'runId' | 'phase' | 'floor' | 'path' | 'found' | 'reward' | 'battle'>;

export function runRecap(state: RecapInput): RunRecap | null {
  if (state.phase !== 'floor-clear' && state.phase !== 'defeat') return null;
  const won = state.phase === 'floor-clear';
  const visited = state.path.length;
  return {
    runId: state.runId,
    result: won ? 'conquered' : 'fallen',
    floor: state.floor,
    roomsCleared: won ? FLOOR_ROWS + 1 : Math.max(0, visited - 1),
    roomsVisited: won ? FLOOR_ROWS + 1 : visited,
    roomsTotal: ENCOUNTERS_PER_RUN,
    fellTo: won ? null : state.battle?.foe.name ?? null,
    bossReward: won ? state.reward?.loot ?? null : null,
    found: state.found.slice(),
  };
}

export function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

/** Where the loot went, in plain words, for the current save mode. */
export function lootRetainedLine(mode: SaveMode, won: boolean): string {
  if (mode === 'vault') return won ? 'Your loot is saved to your vault.' : 'Your loot is retained: every piece of gear you found is saved to your vault.';
  if (mode === 'visit') return 'Your loot is retained in camp for this visit. This run isn\u2019t saved to your account.';
  return 'Your loot is retained in camp for this preview. This run isn\u2019t saved to your account.';
}
