/** Pure, serialisable Mulberry32 stream: the state is one uint32 and every draw returns the next state. */
export type Rng = number;

export function seedRng(seed: number): Rng {
  if (!Number.isFinite(seed)) return 1;
  return (Math.floor(Math.abs(seed)) >>> 0) || 1;
}

export function nextRoll(state: Rng): [number, Rng] {
  const advanced = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(advanced ^ (advanced >>> 15), 1 | advanced);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, advanced >>> 0];
}

/** Draw an integer in [0, size). */
export function nextIndex(state: Rng, size: number): [number, Rng] {
  const [roll, next] = nextRoll(state);
  return [Math.min(size - 1, Math.floor(roll * size)), next];
}

/** Weighted pick. Weights must be non-negative and not all zero. */
export function nextWeighted<T extends string>(state: Rng, weights: readonly (readonly [T, number])[]): [T, Rng] {
  const total = weights.reduce((sum, [, weight]) => sum + Math.max(0, weight), 0);
  const [roll, next] = nextRoll(state);
  let cursor = roll * total;
  for (const [value, weight] of weights) {
    cursor -= Math.max(0, weight);
    if (cursor < 0) return [value, next];
  }
  return [weights[weights.length - 1][0], next];
}
