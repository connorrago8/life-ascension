/**
 * Presentational flourish for a completed sample quest.
 * `amount` is the quest's own sample XP. This component does not add it,
 * store it, or decide a level.
 */
export function QuestCompleteFx({ amount }: { amount: number }) {
  return (
    <p className="xp-float" role="status" data-xp-float={amount}>
      +{amount} XP
    </p>
  );
}
