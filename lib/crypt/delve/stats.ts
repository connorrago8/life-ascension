/**
 * Hero attributes for a Crypt delve: the approved five stats STR, AGI, INT, END, LCK.
 * Points come ONLY from your real-quest level: you allocate them yourself.
 * The Crypt reads the level; it never writes quest XP.
 */
export const ATTRIBUTE_KEYS = ['strength', 'agility', 'intelligence', 'endurance', 'luck'] as const;
export type AttributeKey = (typeof ATTRIBUTE_KEYS)[number];
export type Attributes = Record<AttributeKey, number>;

export const ZERO_ATTRIBUTES: Attributes = { strength: 0, agility: 0, intelligence: 0, endurance: 0, luck: 0 };
export const POINTS_PER_LEVEL = 2;
/** Every Wayfarer starts with a few points so Level 1 can still win sometimes. */
export const STARTING_POINTS = 7;
/** Mirrors the SQL cap in set_crypt_attributes. */
export const MAX_POINTS_PER_ATTRIBUTE = 60;

export const ATTRIBUTE_INFO: Record<AttributeKey, { short: string; label: string; effect: string }> = {
  strength: { short: 'STR', label: 'Strength', effect: '+4 damage per 5 points on physical attacks' },
  agility: { short: 'AGI', label: 'Agility', effect: 'Act first (+1 energy on turn 1 at 3, every turn at 10), +4% sixth-card draw and +3% dodge each' },
  intelligence: { short: 'INT', label: 'Intelligence', effect: 'Stronger spells (fire, frost, holy, arcane), poison and weaken; more Block and healing' },
  endurance: { short: 'END', label: 'Endurance', effect: '+2.5 max HP each and +1 Block per 3 points' },
  luck: { short: 'LCK', label: 'Luck', effect: '+3% crit each (crits deal ×2), +1 damage per 4, more and rarer gear' },
};

/** Points you may spend: 7 to start, plus 2 per real-quest level (Level 1 = 9, Level 5 = 17). */
export function pointsForLevel(level: number): number {
  const safe = Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 1;
  return STARTING_POINTS + safe * POINTS_PER_LEVEL;
}

function clean(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

export function parseAttributes(value: unknown): Attributes {
  const row = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const result = { ...ZERO_ATTRIBUTES };
  for (const key of ATTRIBUTE_KEYS) result[key] = clean(row[key]);
  return result;
}

export function spentPoints(attributes: Attributes): number {
  return ATTRIBUTE_KEYS.reduce((sum, key) => sum + clean(attributes[key]), 0);
}

/** Allocation is valid when it never spends more than the level allows. */
export function isValidAllocation(attributes: Attributes, level: number): boolean {
  return ATTRIBUTE_KEYS.every((key) => Number.isInteger(attributes[key]) && attributes[key] >= 0
    && attributes[key] <= MAX_POINTS_PER_ATTRIBUTE)
    && spentPoints(attributes) <= pointsForLevel(level);
}

/** If the level went down (or data is stale), trim from the end so it is valid. */
export function clampAllocation(attributes: Attributes, level: number): Attributes {
  const result = parseAttributes(attributes);
  for (const key of ATTRIBUTE_KEYS) result[key] = Math.min(MAX_POINTS_PER_ATTRIBUTE, result[key]);
  let over = spentPoints(result) - pointsForLevel(level);
  for (const key of [...ATTRIBUTE_KEYS].reverse()) {
    if (over <= 0) break;
    const cut = Math.min(result[key], over);
    result[key] -= cut;
    over -= cut;
  }
  return result;
}

export function adjustAttribute(attributes: Attributes, key: AttributeKey, delta: 1 | -1, level: number): Attributes {
  const next = { ...attributes, [key]: attributes[key] + delta };
  return isValidAllocation(next, level) ? next : attributes;
}

export function addAttributes(a: Attributes, b: Partial<Attributes>): Attributes {
  const result = { ...a };
  for (const key of ATTRIBUTE_KEYS) result[key] = a[key] + (b[key] ?? 0);
  return result;
}

export const BASE_HP = 40;

export function maxHpFor(attributes: Attributes, level: number): number {
  return BASE_HP + Math.floor((attributes.endurance * 5) / 2) + Math.max(1, Math.floor(level) || 1) * 2;
}

/** Crit chance from LCK, capped at 45%. */
export function critChance(attributes: Attributes): number {
  return Math.min(0.45, attributes.luck * 0.03);
}

/** Chance to dodge each enemy hit, from AGI, capped at 40%. */
export function dodgeChance(attributes: Attributes): number {
  return Math.min(0.4, attributes.agility * 0.03);
}
