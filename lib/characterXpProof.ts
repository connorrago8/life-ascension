/**
 * UI-only validation of get_lifetime_xp's read-only response.
 * A missing, malformed or unsafe response must never be displayed as Level 1.
 * This is NOT a reward receipt or a substitute for Alpha's authoritative ledger.
 */
export function verifiedLifetimeXp(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value >= 0 ? value : null;
  }
  if (typeof value === 'bigint') {
    return value >= BigInt(0) && value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : null;
  }
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    const parsed = Number(value.trim());
    return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
  }
  return null;
}
