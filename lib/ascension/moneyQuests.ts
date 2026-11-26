export type MoneyRow = {
  date: string;
  category: string;
  amount: number;
  pending?: boolean;
};

export type CheckState = 'matched' | 'needs_review' | 'unchanged' | 'waiting';

export function isPostedPayment(row: MoneyRow): boolean {
  if (row.pending) return false;
  if (/payment/i.test(row.category)) return true;
  return /transfer/i.test(row.category) && row.amount < 0;
}

export function isSpend(row: MoneyRow): boolean {
  if (row.pending) return false;
  if (/transfer/i.test(row.category)) return false;
  return row.amount < 0;
}

export function paymentPostedState(rows: readonly MoneyRow[], weekStart: string, weekEnd: string): CheckState {
  const window = rows.filter((row) => row.date >= weekStart && row.date <= weekEnd);
  if (window.some(isPostedPayment)) return 'matched';
  if (window.length > 0) return 'needs_review';
  return 'unchanged';
}

export function noSpendState(rows: readonly MoneyRow[], day: string): CheckState {
  const posted = rows.filter((row) => row.date === day && !row.pending);
  if (posted.length === 0) return 'unchanged';
  if (posted.some(isSpend)) return 'needs_review';
  return 'matched';
}

export function weekSpendingState(rows: readonly MoneyRow[], weekStart: string, weekEnd: string, viewed: boolean): CheckState {
  const posted = rows.some((row) => !row.pending && row.date >= weekStart && row.date <= weekEnd);
  if (!viewed) return 'waiting';
  return posted ? 'matched' : 'needs_review';
}

/** A match pays through the existing completion path once. A second match pays 0. */
export function xpOnce(alreadyComplete: boolean, matched: boolean): { pay: boolean; xp: number } {
  if (!matched || alreadyComplete) return { pay: false, xp: 0 };
  return { pay: true, xp: 10 };
}
