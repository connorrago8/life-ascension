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
  if (hasLedgerProof && receipt.reward_status === 'awarded') {
    const streak = streakDetail(receipt);
    if (receipt.xp_awarded === 1) return `Quest completed. +1 XP earned.${streak.note}`;
    // More than +1 only when the receipt shows exactly the server's streak rule:
    // a non-first completion of a 1 XP quest, floor(1 × (10 + F) / 10) XP.
    if (streak.bonusXp !== null && receipt.xp_awarded === streak.bonusXp) {
      return `Quest completed. +${streak.bonusXp} XP earned (🔥 ${receipt.streak_fire} streak bonus +${receipt.streak_fire * 10}%).`;
    }
  }
  if (hasLedgerProof && receipt.reward_status === 'already_awarded'
      && receipt.xp_awarded === 0) {
    return 'Quest already completed. XP was awarded previously.';
  }
  return 'Quest completion confirmed, but XP award could not be verified.';
}

/** Streak fields of the receipt (202610310001). Absent fields: no note, no bonus. */
function streakDetail(receipt) {
  const fire = receipt.streak_fire;
  if (receipt.base_xp !== 1 || !Number.isSafeInteger(fire) || fire < 0
      || typeof receipt.first_of_day !== 'boolean') {
    return { note: '', bonusXp: null };
  }
  if (receipt.first_of_day) {
    return { note: fire > 0 ? ` 🔥 ${fire} streak kept.` : ' 🔥 Streak started.', bonusXp: null };
  }
  const bonusXp = Math.floor((10 + fire) / 10);
  if (bonusXp > 1) return { note: '', bonusXp };
  return { note: fire > 0 ? ` 🔥 ${fire} bonus +${fire * 10}% (rounds to +1 until 🔥 10).` : '', bonusXp: null };
}
