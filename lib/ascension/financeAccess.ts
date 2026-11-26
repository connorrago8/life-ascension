import type { SessionRole } from '../companionAccess';

/** Amounts, the CSV import, and the ingest token stay on the adventurer Finance page. */
export function financeImportVisible(role: SessionRole): boolean {
  return role === 'adventurer';
}
