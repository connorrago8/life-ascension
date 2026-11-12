import test from 'node:test';
import assert from 'node:assert/strict';
import { levelFor } from '../lib/level.ts';
import { gameDayParts } from '../lib/questStreak.ts';
import { isSundayGameDay, levelsGained, recapShows, recapWeek } from '../lib/coupleRecap.ts';

test('Sunday recap opens at 05:00 Chicago and covers the previous seven game days', () => {
  const before = gameDayParts(new Date('2026-11-15T10:59:00Z'), 'America/Chicago');
  const at = gameDayParts(new Date('2026-11-15T11:00:00Z'), 'America/Chicago');
  assert.equal(before.date, '2026-11-14');
  assert.equal(recapShows(before.date), false);
  assert.equal(at.date, '2026-11-15');
  assert.equal(isSundayGameDay(at.date), true);
  assert.equal(recapShows(at.date), true);
  assert.deepEqual(recapWeek('2026-11-15'), { weekStart: '2026-11-08', weekEnd: '2026-11-15' });
  assert.equal(levelsGained(0, 30), 2);
  assert.equal(levelsGained(0, 20), 1);
  assert.equal(levelsGained(25, 0), 0);
  for (const xp of [0, 10, 20, 25, 30, 270, 400]) {
    assert.equal(levelsGained(0, xp), levelFor(xp).level - levelFor(0).level);
  }
});
