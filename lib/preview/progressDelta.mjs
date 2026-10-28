/**
 * Compute a safe single-operation progress delta without awarding XP.
 * The existing server accepts only one configured increment per undo;
 * clearing a larger amount must not invent an unsupported negative RPC.
 * @param {{target:number, amount:number, increment:number}} progress
 * @param {'add'|'undo'|'clear'} action
 * @returns {number|null}
 */
export function nextProgressDelta({target, amount, increment}, action) {
  if (![target, amount, increment].every(Number.isSafeInteger) || target < 1 ||
      increment < 1 || increment > target || amount < 0 || amount > target) return null;
  if (action === 'add') return amount < target ? Math.min(increment, target - amount) : null;
  if (action === 'undo') return amount >= increment ? -increment : null;
  // A one-step clear is supported by the existing idempotent undo RPC.
  // A multi-step/partial custom amount clear requires Alpha's server contract.
  if (action === 'clear') return amount === increment ? -increment : null;
  return null;
}
