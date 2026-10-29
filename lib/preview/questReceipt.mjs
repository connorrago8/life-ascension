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
  const parts = typeof awardedAt === 'string'
    ? /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/.exec(awardedAt)
    : null;
  // Date.parse normalizes impossible dates (e.g. February 30); do not treat
  // a normalized value as evidence that the server issued a real XP receipt.
  const validCalendarTime = parts !== null && (() => {
    const [, yearText, monthText, dayText, hourText, minuteText, secondText, zone] = parts;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const monthDays = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    const offsetHour = zone === 'Z' ? 0 : Number(zone.slice(1, 3));
    const offsetMinute = zone === 'Z' ? 0 : Number(zone.slice(4, 6));
    return year > 0 && month >= 1 && month <= 12
      && day >= 1 && day <= monthDays[month - 1]
      && Number(hourText) <= 23 && Number(minuteText) <= 59 && Number(secondText) <= 59
      && offsetHour <= 23 && offsetMinute <= 59;
  })();
  const hasLedgerProof = receipt.reward_confirmed === true
    && validCalendarTime && Number.isFinite(Date.parse(awardedAt));
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
