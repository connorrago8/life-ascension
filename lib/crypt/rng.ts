/** Mulberry32. Same seed and index always yield the same roll. */

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Roll `index` (0-based) from `seed`, with no hidden cursor. */
export function rollAt(seed: number, index: number): number {
  const next = mulberry32(seed >>> 0);
  const steps = index < 0 ? 1 : Math.floor(index) + 1;
  let value = 0;
  for (let i = 0; i < steps; i += 1) value = next();
  return value;
}
