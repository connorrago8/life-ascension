export const treasuryQuests = [
  { key: 'gambling-free', title: 'Gambling-Free Guardian', points: 30 },
  { key: 'budget', title: 'Budget Guardian', points: 20 },
  { key: 'low-spend', title: 'Frugal Adventurer', points: 15 },
  { key: 'revolving-debt', title: 'Debt Defender', points: 15 },
  { key: 'payments', title: 'Payment Protector', points: 10 },
  { key: 'review', title: 'Treasury Review', points: 10 },
] as const;

type QuestKey = (typeof treasuryQuests)[number]['key'];
type FinancialQuest = Exclude<QuestKey, 'review'>;

export function evaluateTreasuryWeek(
  outcomes: Record<FinancialQuest, boolean | null>,
  reviewCompleted: boolean,
  closed: boolean,
) {
  const results: Record<QuestKey, boolean | null> = { ...outcomes, review: reviewCompleted };
  const quests = treasuryQuests.map((quest) => {
    const result = results[quest.key];
    const state = result === null
      ? 'pending verification'
      : quest.key === 'review' && result
        ? 'completed'
        : !closed
          ? 'in progress'
          : result ? 'completed' : 'missed';
    return { ...quest, state };
  });
  return {
    quests,
    score: quests.reduce((score, quest) => score + (quest.state === 'completed' ? quest.points : 0), 0),
  };
}

export function budgetStatus(spentCents: number, budgetCents: number, closed: boolean, verified: boolean) {
  if (spentCents > budgetCents) {
    if (!closed) return 'at risk';
    return verified ? 'missed' : 'pending verification';
  }
  if (budgetCents === 0) return 'within limit';
  if (spentCents * 100 >= budgetCents * 90) return 'at risk';
  if (spentCents * 100 >= budgetCents * 75) return 'watch';
  return 'within limit';
}

export function isLowSpendDay(
  expenses: readonly { amountCents: number; essential: boolean }[],
  limitCents: number,
  coverageComplete: boolean,
): boolean | null {
  if (!coverageComplete) return null;
  const discretionaryCents = expenses.reduce(
    (total, expense) => total + (expense.essential ? 0 : expense.amountCents),
    0,
  );
  return discretionaryCents <= limitCents;
}
