import assert from 'node:assert/strict';
import test from 'node:test';
import { coerceXp, levelFor, levelProgress, xpToAdvance, xpToReachLevel } from '../lib/level.ts';

/** Design board: XP needed to reach the level, and the cumulative total. */
const BOARD = [
  { level: 1, step: 0, total: 0 },
  { level: 2, step: 10, total: 10 },
  { level: 3, step: 15, total: 25 },
  { level: 4, step: 20, total: 45 },
  { level: 5, step: 25, total: 70 },
  { level: 6, step: 30, total: 100 },
  { level: 7, step: 35, total: 135 },
  { level: 8, step: 40, total: 175 },
  { level: 9, step: 45, total: 220 },
  { level: 10, step: 50, total: 270 },
];

test('the board curve reaches level 10 at 270 XP and steps up by 5', () => {
  assert.equal(xpToReachLevel(1), 0);
  assert.equal(xpToReachLevel(10), 270);
  for (const row of BOARD) {
    assert.equal(xpToReachLevel(row.level), row.total, `total for level ${row.level}`);
    if (row.level === 1) {
      assert.equal(xpToAdvance(1), 10);
    } else {
      assert.equal(xpToAdvance(row.level - 1), row.step, `step into level ${row.level}`);
    }
  }
  for (let level = 2; level <= 12; level += 1) {
    assert.equal(xpToAdvance(level) - xpToAdvance(level - 1), 5);
  }
});

test('levelFor matches the board at each threshold and one XP below it', () => {
  const start = levelFor(0);
  assert.deepEqual(start, { level: 1, xpIntoLevel: 0, xpForNext: 10 });
  assert.deepEqual(levelFor(9), { level: 1, xpIntoLevel: 9, xpForNext: 10 });

  for (const row of BOARD) {
    if (row.level === 1) continue;
    assert.deepEqual(levelFor(row.total), {
      level: row.level,
      xpIntoLevel: 0,
      xpForNext: xpToAdvance(row.level),
    });
    const previous = BOARD[row.level - 2];
    const almost = levelFor(row.total - 1);
    assert.equal(almost.level, previous.level);
    assert.equal(almost.xpIntoLevel, row.step - 1);
    assert.equal(almost.xpForNext, row.step);
  }
});

test('early totals land on the levels the board describes', () => {
  assert.equal(levelFor(0).level, 1);
  assert.equal(levelFor(9).level, 1);
  assert.equal(levelFor(10).level, 2);
  assert.equal(levelFor(24).level, 2);
  assert.equal(levelFor(25).level, 3);
  assert.equal(levelFor(29).level, 3);
  assert.equal(levelFor(30).level, 3);
  assert.equal(levelFor(44).level, 3);
  assert.equal(levelFor(45).level, 4);
  assert.equal(levelFor(269).level, 9);
  assert.equal(levelFor(270).level, 10);
  assert.equal(levelFor(324).level, 10);
  assert.equal(levelFor(325).level, 11);
});

test('progress fraction stays inside [0, 1) and a fresh adventurer at 2 XP is 2/10', () => {
  const fresh = levelFor(2);
  assert.deepEqual(fresh, { level: 1, xpIntoLevel: 2, xpForNext: 10 });
  assert.equal(levelProgress(2), 0.2);

  for (let xp = 0; xp <= 400; xp += 1) {
    const fraction = levelProgress(xp);
    assert.ok(fraction >= 0 && fraction < 1, `${xp} -> ${fraction}`);
  }
  assert.ok(levelProgress(10_000) < 1);
  assert.equal(levelFor(270).xpIntoLevel, 0);
});

test('coerceXp accepts the shapes get_lifetime_xp can return', () => {
  assert.equal(coerceXp(2), 2);
  assert.equal(coerceXp(2.9), 2);
  assert.equal(coerceXp(-4), 0);
  assert.equal(coerceXp('15'), 15);
  assert.equal(coerceXp(' 15 '), 15);
  assert.equal(coerceXp(15n), 15);
  assert.equal(coerceXp(null), 0);
  assert.equal(coerceXp(undefined), 0);
  assert.equal(coerceXp('nope'), 0);
  assert.equal(coerceXp(Number.NaN), 0);
  assert.equal(levelFor(-3).level, 1);
});
