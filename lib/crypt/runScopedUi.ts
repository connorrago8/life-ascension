/** Ephemeral Crypt UI choices must not survive into a different preview run. */
export type RunScopedValue<T> = { seed: number; value: T } | null;

export function scopeRunValue<T>(seed: number, value: T): RunScopedValue<T> {
  return { seed, value };
}

export function readScopedRunValue<T>(entry: RunScopedValue<T>, seed: number): T | null {
  return entry?.seed === seed ? entry.value : null;
}

export function toggleScopedRunFlag(entry: RunScopedValue<boolean>, seed: number): RunScopedValue<boolean> {
  return scopeRunValue(seed, readScopedRunValue(entry, seed) !== true);
}
