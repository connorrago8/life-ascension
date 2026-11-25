import test from 'node:test';
import assert from 'node:assert/strict';
import { paydaySummary, paydays } from '../lib/ascension/trackers.ts';

const baseline = {
  cash: '12400', obligations: '1000', reserved: '500', used: '400',
  promo: '4739', expected: '100', promoReserved: '500',
};

test('payday review protects cash and reserved dollars and reports the promo gap in cents', () => {
  assert.deepEqual(paydaySummary(baseline), { safe: 80000, shortfall: 0, gap: 413900 });
  assert.equal(paydaySummary({ ...baseline, cash: '11800.25' }).safe, 30025);
  assert.equal(paydaySummary({ ...baseline, cash: '9500' }).safe, 0);
  assert.equal(paydaySummary({ ...baseline, cash: '800' }).shortfall, 20000);
  assert.equal(paydaySummary({ ...baseline, used: '' }).safe, null);
  assert.equal(paydaySummary({ ...baseline, promo: '' }).gap, null);
});

test('the biweekly review starts Dec 3 and ends before the June promo deadline', () => {
  assert.equal(paydays[0], '2026-12-03');
  assert.ok(paydays.includes('2027-04-08'));
  assert.equal(paydays.at(-1), '2027-05-20');
});
