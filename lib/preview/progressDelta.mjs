/**
 * Compute a safe single-operation progress delta without awarding XP.
 * Alpha's verified 0008 contract permits either one configured increment undo
 * or an atomic clear of the entire current amount, using the same journaled RPC.
 * @param {{target:number, amount:number, increment:number}} progress
 * @param {'add'|'undo'|'clear'} action
 * @returns {number|null}
 */
export function nextProgressDelta({target, amount, increment}, action) {
  if (![target, amount, increment].every(Number.isSafeInteger) || target < 1 ||
      increment < 1 || increment > target || amount < 0 || amount > target) return null;
  if (action === 'add') return amount < target ? Math.min(increment, target - amount) : null;
  if (action === 'undo') return amount >= increment ? -increment : null;
  // PR #21 60dc6eb: an atomic, journaled clear sends -current_amount.
  // Zero cannot be cleared and must never create a no-op request.
  if (action === 'clear') return amount > 0 ? -amount : null;
  return null;
}

/** Fail closed if PostgREST does not return the one-row progress RPC result.
 * A transport success alone is not evidence that the pending operation was saved.
 * This is not an XP receipt: only the versioned completion RPC can claim +1 XP.
 */
export function confirmedProgressResult(data) {
  if (!Array.isArray(data) || data.length !== 1) return null;
  const row = data[0];
  if (!row || typeof row !== 'object' || Array.isArray(row)
      || !Number.isSafeInteger(row.current_amount) || row.current_amount < 0
      || (row.status !== 'available' && row.status !== 'completed')
      || typeof row.completed_now !== 'boolean'
      || (row.status === 'completed' && row.current_amount === 0) || (row.completed_now && row.status !== 'completed')) return null;
  return { currentAmount: row.current_amount, status: row.status, completedNow: row.completed_now };
}
