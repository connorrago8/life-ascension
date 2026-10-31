import { LOOT_IDS } from './crypt/delve/loot.ts';
import { parseAttributes, type Attributes } from './crypt/delve/stats.ts';

/**
 * Pure helpers for the Crypt vault account layer (components/delve/DelveScreen.tsx).
 * The server decides everything that matters (points, loot allowlist, the
 * 10%-of-today's-quest-XP cap); these only read its answers safely.
 */
export type CryptProfile = {
  attributes: Attributes;
  vaultItemIds: string[];
  deepestFloor: number;
  tenthsToday: number;
  capToday: number;
  cryptXp: number;
};

function count(value: unknown): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

export function parseCryptProfile(value: unknown): CryptProfile {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const ids = Array.isArray(raw.vaultItemIds) ? raw.vaultItemIds : [];
  return {
    attributes: parseAttributes(raw.attributes),
    vaultItemIds: ids.filter((id): id is string => typeof id === 'string' && LOOT_IDS.includes(id)),
    deepestFloor: count(raw.deepestFloor),
    tenthsToday: count(raw.tenthsToday),
    capToday: count(raw.capToday),
    cryptXp: count(raw.cryptXp),
  };
}

export function tenthsLabel(tenths: number): string {
  const safe = count(tenths);
  return `${Math.floor(safe / 10)}.${safe % 10}`;
}

export function capNote(tenthsToday: number, capToday: number): string {
  if (capToday <= 0) return 'Crypt XP today: none available yet. Finish a real quest first (Crypt XP is capped at 10% of today’s quest XP).';
  return `Crypt XP today: ${tenthsLabel(tenthsToday)} of ${tenthsLabel(capToday)} (10% of today’s quest XP).`;
}

export function floorClearMessage(value: unknown): string {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const awarded = count(raw.tenthsAwarded);
  const head = 'Checkpoint saved: Floor 1 cleared.';
  const xp = awarded > 0 ? ` Crypt XP +${tenthsLabel(awarded)}.` : ' No Crypt XP this time (today’s cap is reached).';
  return `${head}${xp} ${capNote(count(raw.tenthsToday), count(raw.capToday))}`;
}
