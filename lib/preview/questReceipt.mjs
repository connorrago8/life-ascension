/** Pure, fail-closed completion feedback for Alpha's versioned v2 RPC.
 * No XP is inferred from lifetime XP deltas, client state, or transport success.
 * The server's newly minted ledger receipt is the only source of a +1 claim.
 */
export function completionFeedback(receipt, instanceId) {
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)
      || receipt.schema_version !== 1
      || receipt.quest_instance_id !== instanceId
      || receipt.status !== 'completed'
      || receipt.quest_completion_confirmed !== true) {
    return 'Quest completion not verified. Refresh to check its status and XP.';
  }
  // The v2 SQL receipt serializes ledger timestamptz as RFC3339 with a zone.
  // A nonempty but malformed timestamp is not credible ledger proof.
  const awardedAt = receipt.reward_awarded_at;
  const hasLedgerProof = receipt.reward_confirmed === true
    && typeof awardedAt === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(awardedAt)
    && Number.isFinite(Date.parse(awardedAt));
  if (hasLedgerProof && receipt.reward_status === 'awarded'
      && receipt.xp_awarded === 1) {
    return 'Quest completed. +1 XP earned.';
  }
  if (hasLedgerProof && receipt.reward_status === 'already_awarded'
      && receipt.xp_awarded === 0) {
    return 'Quest already completed. XP was awarded previously.';
  }
  return 'Quest completion confirmed, but XP award could not be verified.';
}
