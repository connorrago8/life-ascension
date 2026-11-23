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
      <section aria-labelledby="treasury-plan-heading">
        <h3 id="treasury-plan-heading">Two-week spending plan</h3>
        <ul>
          <li>Stay within the weekly cap after bills · Pending budget review</li>
          <li>Tuesday: spend $10 or less on nonessentials. Wednesday is the backup.</li>
          <li>Monday: $0 in sportsbook deposits.</li>
        </ul>
        <p>Friday: choose Saturday dinner before the weekend.</p>
        <p>After a $150 discretionary day, review what else is planned and choose what can wait.</p>
      </section>
    </details>
  );
}
