export const ATTRIBUTE_PLACEHOLDER = '—';

/** Approved attribute set: STR, AGI, INT, END, LCK (same five the Crypt delve uses). */
export const ATTRIBUTES = [
  { key: 'strength', label: 'Strength', short: 'STR' },
  { key: 'agility', label: 'Agility', short: 'AGI' },
  { key: 'intelligence', label: 'Intelligence', short: 'INT' },
  { key: 'endurance', label: 'Endurance', short: 'END' },
  { key: 'luck', label: 'Luck', short: 'LCK' },
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

/** Prefer profiles.display_name when it is set. Otherwise the email local part. */
export function adventurerName(email: string | null | undefined, displayName: unknown): string {
  if (typeof displayName === 'string' && displayName.trim()) return displayName.trim();
  const local = email?.split('@')[0]?.trim();
  if (local) return local;
  return 'Adventurer';
}
