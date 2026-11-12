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

test('one missed day is bridged, two missed days reset, and a month does not stack', () => {
  const one = fireWithShields(['2026-04-10', '2026-04-12'], '2026-04-13');
  assert.equal(one.fire, 2);
  assert.equal(one.shields.get(shieldMonth('2026-04-11')), '2026-04-11');

  const two = fireWithShields(['2026-04-10', '2026-04-13'], '2026-04-14');
  assert.equal(two.fire, 1);
  assert.equal(two.shields.size, 0);

  const roll = fireWithShields(['2026-01-29', '2026-01-31', '2026-02-01', '2026-02-03'], '2026-02-04');
  assert.equal(roll.fire, 4);
  assert.equal(roll.shields.size, 2);
  assert.equal(roll.shields.get('2026-01-01'), '2026-01-30');
  assert.equal(roll.shields.get('2026-02-01'), '2026-02-02');

  const again = fireWithShields(['2026-01-10', '2026-01-12', '2026-01-13', '2026-01-15'], '2026-01-16');
  assert.equal(again.fire, 3);
  assert.equal(again.shields.size, 1);
  assert.match(shieldLabel('used', { doneToday: false }), /No XP was awarded/);
});
