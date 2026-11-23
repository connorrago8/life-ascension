import { budgetStatus, evaluateTreasuryWeek, isLowSpendDay } from '../../lib/treasury';

export default function TreasuryPreview() {
  const lowSpendDays = [800, 1000, 500, 1200].filter((amountCents) =>
    isLowSpendDay([{ amountCents, essential: false }, { amountCents: 4500, essential: true }], 1000, true),
  ).length;
  const week = evaluateTreasuryWeek({
    'gambling-free': null,
    budget: true,
    'low-spend': lowSpendDays >= 3,
    'revolving-debt': null,
    payments: true,
  }, true, true);

  return (
    <details className="row treasury-preview">
      <summary>Treasury · {week.score}/100 points</summary>
      <p>Sample week · no character XP awarded</p>
      <p>Discretionary budget · $40 remaining</p>
      <p>Delivery · {budgetStatus(4100, 4000, true, true)} · $1 over</p>
      <p>Low-spend days · {lowSpendDays}/3</p>
      <ul>
        {week.quests.map((quest) => (
          <li key={quest.key}>{quest.title} · {quest.points} points · {quest.state}</li>
        ))}
      </ul>
      <p>Next week: plan one pickup meal in place of delivery.</p>
    </details>
  );
}
