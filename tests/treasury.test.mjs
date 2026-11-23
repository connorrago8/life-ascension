import assert from 'node:assert/strict';
import test from 'node:test';
import { budgetStatus, evaluateTreasuryWeek, isLowSpendDay } from '../lib/treasury.ts';

const outcomes = {
  'gambling-free': null,
  budget: true,
  'low-spend': true,
  'revolving-debt': false,
  payments: true,
};

test('weekly scoring holds unverified outcomes and waits for close', () => {
  const open = evaluateTreasuryWeek(outcomes, true, false);
  assert.equal(open.score, 10);
  const closed = evaluateTreasuryWeek(outcomes, true, true);
  assert.equal(closed.score, 55);
  assert.equal(closed.quests.find((quest) => quest.key === 'gambling-free').state, 'pending verification');
  assert.equal(closed.quests.find((quest) => quest.key === 'revolving-debt').state, 'missed');
  assert.equal(closed.quests.reduce((sum, quest) => sum + quest.points, 0), 100);
});

test('category thresholds distinguish warnings from verified misses', () => {
  assert.equal(budgetStatus(7499, 10000, false, true), 'within limit');
  assert.equal(budgetStatus(7500, 10000, false, true), 'watch');
  assert.equal(budgetStatus(8999, 10000, false, true), 'watch');
  assert.equal(budgetStatus(9000, 10000, false, true), 'at risk');
  assert.equal(budgetStatus(10000, 10000, true, true), 'at risk');
  assert.equal(budgetStatus(10100, 10000, false, true), 'at risk');
  assert.equal(budgetStatus(10100, 10000, true, false), 'pending verification');
  assert.equal(budgetStatus(10100, 10000, true, true), 'missed');
  assert.equal(budgetStatus(0, 0, true, true), 'within limit');
  assert.equal(budgetStatus(1, 0, true, true), 'missed');
});

test('low-spend days exclude essentials and wait for complete coverage', () => {
  const expenses = [
    { amountCents: 3500, essential: true },
    { amountCents: 1000, essential: false },
  ];
  assert.equal(isLowSpendDay(expenses, 1000, true), true);
  assert.equal(isLowSpendDay(expenses, 999, true), false);
  assert.equal(isLowSpendDay(expenses, 1000, false), null);
  assert.equal(isLowSpendDay([], 1000, false), null);
});
