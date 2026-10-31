import type { RunState } from './run.ts';

/** Versioned, pure serialization contract. No browser storage or account writes here. */
export const CRYPT_SAVE_VERSION = 1 as const;
export type CryptSave = {
  version: typeof CRYPT_SAVE_VERSION;
  run: RunState;
  savedAt: string;
};

const phases = new Set(['intro', 'gate', 'map', 'fight', 'event', 'treasure', 'end']);
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
function boolean(value: unknown): value is boolean { return typeof value === 'boolean'; }

/** Reject malformed or incompatible saves; never silently start a new run on parse failure. */
export function parseCryptSave(serialized: string): CryptSave | null {
  let value: unknown;
  try { value = JSON.parse(serialized); } catch { return null; }
  if (!record(value) || value.version !== CRYPT_SAVE_VERSION || !record(value.run)) return null;
  const run = value.run;
  if (typeof value.savedAt !== 'string' || !Number.isFinite(Date.parse(value.savedAt))) return null;
  if (!phases.has(run.phase as string) || !finiteNumber(run.seed) || run.seed < 1 || !Number.isSafeInteger(run.seed)) return null;
  if (!finiteNumber(run.hp) || !finiteNumber(run.maxHp) || run.maxHp <= 0 || run.hp < 0 || run.hp > run.maxHp) return null;
  if (!finiteNumber(run.attackBonus) || !finiteNumber(run.fightAttempt) || !Number.isSafeInteger(run.fightAttempt) || run.fightAttempt < 0) return null;
  for (const field of ['fightCleared', 'guardianCleared', 'sigilCollected', 'eventCleared', 'treasureCleared']) {
    if (!boolean(run[field])) return null;
  }
  if (!['take', 'leave', null].includes(run.relicChoice as null)) return null;
  for (const field of ['hint', 'eventChoiceId', 'outcomeNote', 'encounterId']) {
    if (run[field] !== null && typeof run[field] !== 'string') return null;
  }
  if (run.hpAtFightStart !== null && !finiteNumber(run.hpAtFightStart)) return null;
  if (run.phase === 'fight' && (!record(run.battle) || typeof run.encounterId !== 'string')) return null;
  if (run.battle !== null && !record(run.battle)) return null;
  return value as CryptSave;
}

export function serializeCryptSave(run: RunState, savedAt = new Date()): string {
  if (!Number.isFinite(savedAt.getTime())) throw new Error('Invalid save timestamp');
  const serialized = JSON.stringify({ version: CRYPT_SAVE_VERSION, run, savedAt: savedAt.toISOString() });
  if (!parseCryptSave(serialized)) throw new Error('Invalid Crypt run state; refusing to persist');
  return serialized;
}
