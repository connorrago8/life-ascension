import { BOSS, FLOOR_NAME, FLOOR_ROWS, generateFloor, type Room } from './floor.ts';
import type { Rng } from './rng.ts';

/**
 * What a floor is, separate from a run that is walking through it.
 * Floor 1 is today's Crypt: 12 rows and the Hollow Warden. Later floors
 * are added here; nothing else should hard-code that layout.
 */
export type FloorDefinition = {
  number: number;
  id: string;
  name: string;
  rows: number;
  bossId: string;
};

export const FLOOR_DEFINITIONS: readonly FloorDefinition[] = [
  {
    number: 1,
    id: 'shattered-vale-1',
    name: FLOOR_NAME,
    rows: FLOOR_ROWS,
    bossId: BOSS.id,
  },
];

/** The journey is the ordered list of floors a run will attempt. Release 1 is Floor 1 only. */
export const JOURNEY: readonly number[] = FLOOR_DEFINITIONS.map((floor) => floor.number);

export function floorByNumber(number: number): FloorDefinition | undefined {
  return FLOOR_DEFINITIONS.find((floor) => floor.number === number);
}

export type JourneyStep =
  | { kind: 'run-complete' }
  | { kind: 'next-floor'; floor: FloorDefinition };

/**
 * The journey, not the fight, decides what a cleared floor means.
 * A listed next floor is used only when that floor is actually defined.
 */
export function journeyAfterClear(floorNumber: number, journey: readonly number[] = JOURNEY): JourneyStep {
  const index = journey.indexOf(floorNumber);
  const nextNumber = index >= 0 ? journey[index + 1] : undefined;
  const next = nextNumber == null ? undefined : floorByNumber(nextNumber);
  if (!next) return { kind: 'run-complete' };
  return { kind: 'next-floor', floor: next };
}

/** One checkpoint per floor of a run. The same floor is not reported twice. */
export function floorCheckpointKey(runId: string, floor: number): string {
  return `${runId}:${floor}`;
}

/** Layout for a defined floor. Unknown shapes are refused instead of invented. */
export function layoutForFloor(floor: FloorDefinition, rng: Rng): { rows: Room[][]; rng: Rng } | null {
  const known = floorByNumber(floor.number);
  if (!known || known.rows !== FLOOR_ROWS || known.bossId !== BOSS.id) return null;
  return generateFloor(rng);
}
