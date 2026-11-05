export const ATTRIBUTE_PLACEHOLDER = '—';

/** Approved attribute set: STR, AGI, INT, END, LCK (same five the Crypt delve uses). */
export const ATTRIBUTES = [
  { key: 'strength', label: 'Strength', short: 'STR' },
  { key: 'agility', label: 'Agility', short: 'AGI' },
  { key: 'intelligence', label: 'Intelligence', short: 'INT' },
  { key: 'endurance', label: 'Endurance', short: 'END' },
  { key: 'luck', label: 'Luck', short: 'LCK' },
] as const;

/**
 * Player-facing stat panels show only the locked attributes.
 * STR and INT are the crypt allocation. VIT and DIS are read from the same
 * profile or crypt-profile payload when those fields are present.
 */
export const LOCKED_ATTRIBUTES = [
  { key: 'strength', label: 'Strength', short: 'STR' },
  { key: 'intelligence', label: 'Intelligence', short: 'INT' },
  { key: 'vitality', label: 'Vitality', short: 'VIT' },
  { key: 'discipline', label: 'Discipline', short: 'DIS' },
] as const;

export type AttributeKey = (typeof ATTRIBUTES)[number]['key'];

/** Display value for an attribute. Missing columns and empty rows stay placeholders. */
export function attributeValue(row: Record<string, unknown> | null | undefined, key: string): string {
  if (!row || typeof row !== 'object') return ATTRIBUTE_PLACEHOLDER;
  const value = row[key];
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string' && value.trim()) return value.trim();
  return ATTRIBUTE_PLACEHOLDER;
}

/** One display cell per attribute. Missing values stay the placeholder. */
export function attributeEntries(row: Record<string, unknown> | null | undefined) {
  return ATTRIBUTES.map((attribute) => {
    const value = attributeValue(row, attribute.key);
    return { ...attribute, value, pending: value === ATTRIBUTE_PLACEHOLDER };
  });
}

/** Home and Character panels: exactly STR, INT, VIT, and DIS. */
export function lockedAttributeEntries(row: Record<string, unknown> | null | undefined) {
  return LOCKED_ATTRIBUTES.map((attribute) => {
    const value = attributeValue(row, attribute.key);
    return { ...attribute, value, pending: value === ATTRIBUTE_PLACEHOLDER };
  });
}

/**
 * Stat row for the locked panel. Profile fields and the crypt profile's
 * attributes object are the same sources the Character page already loads.
 * Unknown keys such as vitality and discipline are kept; this does not
 * allocate points or write the profile.
 */
export function playerStatRow(profile: Record<string, unknown> | null | undefined, cryptProfile: unknown): Record<string, unknown> | null {
  const payload = cryptProfile && typeof cryptProfile === 'object' ? cryptProfile as Record<string, unknown> : null;
  const attributes = payload?.attributes && typeof payload.attributes === 'object' && !Array.isArray(payload.attributes)
    ? payload.attributes as Record<string, unknown>
    : null;
  if (!profile && !attributes) return null;
  return { ...(profile ?? {}), ...(attributes ?? {}) };
}

/** Prefer profiles.display_name when it is set. Otherwise the email local part. */
export function adventurerName(email: string | null | undefined, displayName: unknown): string {
  if (typeof displayName === 'string' && displayName.trim()) return displayName.trim();
  const local = email?.split('@')[0]?.trim();
  if (local) return local;
  return 'Adventurer';
}
