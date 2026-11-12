import test from 'node:test';
import assert from 'node:assert/strict';
import { gameDayParts } from '../lib/questStreak.ts';
import { fireWithShields, shieldLabel, shieldMonth } from '../lib/streakShield.ts';

test('the monthly allowance flips at 05:00 Chicago on the 1st', () => {
  const before = gameDayParts(new Date('2026-03-01T10:59:00Z'), 'America/Chicago');
  const at = gameDayParts(new Date('2026-03-01T11:00:00Z'), 'America/Chicago');
  assert.equal(before.date, '2026-02-28');
  assert.equal(shieldMonth(before.date), '2026-02-01');
  assert.equal(at.date, '2026-03-01');
  assert.equal(shieldMonth(at.date), '2026-03-01');
  assert.equal(shieldLabel('ready'), 'Streak Shield ready · 1 this month');
  assert.match(shieldLabel('used', { doneToday: true }), /Streak Shield used · 0 remaining/);
  assert.match(shieldLabel('used', { doneToday: true }), /No XP was awarded/);
  assert.match(shieldLabel('used'), /Complete a quest today/);
  assert.match(shieldLabel('used', { blocked: true }), /No shields left this month/);
});

test('04:59 is the previous game day and 05:00 opens the next one', () => {
  const before = gameDayParts(new Date('2026-03-14T09:59:00Z'), 'America/Chicago');
  const at = gameDayParts(new Date('2026-03-14T10:00:00Z'), 'America/Chicago');
  assert.equal(before.date, '2026-03-13');
  assert.equal(at.date, '2026-03-14');
});

test('a missing day never spends an unconfirmed shield', () => {
  const unconfirmed = fireWithShields(['2026-04-10', '2026-04-12'], '2026-04-13');
  assert.equal(unconfirmed.fire, 1);
  assert.equal(unconfirmed.shields.size, 0);

  const confirmed = fireWithShields(
    ['2026-04-10', '2026-04-12'],
    '2026-04-13',
    new Map([['2026-04-01', '2026-04-11']]),
  );
  assert.equal(confirmed.fire, 2);
  assert.equal(confirmed.shields.get('2026-04-01'), '2026-04-11');
});

test('two missed days reset and previously confirmed shields do not stack', () => {
  const two = fireWithShields(['2026-04-10', '2026-04-13'], '2026-04-14');
  assert.equal(two.fire, 1);
  assert.equal(two.shields.size, 0);

  const roll = fireWithShields(
    ['2026-01-29', '2026-01-31', '2026-02-01', '2026-02-03'],
    '2026-02-04',
    new Map([['2026-01-01', '2026-01-30'], ['2026-02-01', '2026-02-02']]),
  );
  assert.equal(roll.fire, 4);
  assert.equal(roll.shields.size, 2);

  const again = fireWithShields(
    ['2026-01-10', '2026-01-12', '2026-01-13', '2026-01-15'],
    '2026-01-16',
    new Map([['2026-01-01', '2026-01-11']]),
  );
  assert.equal(again.fire, 1);
  assert.equal(again.shields.size, 1);
  assert.match(shieldLabel('used', { doneToday: false }), /No XP was awarded/);
});


test('month reset follows Chicago daylight and standard time', () => {
  for (const [before, at, previousMonth, nextMonth] of [
    ['2026-04-01T09:59:00Z', '2026-04-01T10:00:00Z', '2026-03-01', '2026-04-01'],
    ['2026-12-01T10:59:00Z', '2026-12-01T11:00:00Z', '2026-11-01', '2026-12-01'],
  ]) {
    assert.equal(shieldMonth(gameDayParts(new Date(before), 'America/Chicago').date), previousMonth);
    assert.equal(shieldMonth(gameDayParts(new Date(at), 'America/Chicago').date), nextMonth);
  }
});

test('streak reads preserve existing receipts and never mutate their input', () => {
  const receipts = new Map([['2026-04-01', '2026-04-11']]);
  const result = fireWithShields(['2026-04-10', '2026-04-12'], '2026-04-13', receipts);
  result.shields.set('2026-05-01', '2026-05-02');
  assert.deepEqual([...receipts], [['2026-04-01', '2026-04-11']]);
});
