import test from 'node:test';
import assert from 'node:assert/strict';
import { callerCoupleAward, claimAward, confirmedAwardAmount, emptyCopy, restoreRow, sectionSlice, shouldVibrate, withStatus } from '../lib/questPolish.ts';

const receipt = {
  schema_version: 1,
  quest_instance_id: 'inst-1',
  status: 'completed',
  quest_completion_confirmed: true,
  reward_confirmed: true,
  reward_status: 'awarded',
  reward_awarded_at: '2026-11-14T15:00:00Z',
  xp_awarded: 10,
  base_xp: 10,
  streak_fire: 0,
  first_of_day: true,
};

test('a confirmed receipt yields one XP amount and a repeat does not', () => {
  assert.equal(confirmedAwardAmount(receipt, 'inst-1'), 10);
  assert.equal(confirmedAwardAmount({ ...receipt, reward_status: 'already_awarded', xp_awarded: 0 }, 'inst-1'), null);
  assert.equal(confirmedAwardAmount(receipt, 'other'), null);
  const seen = new Set();
  const first = claimAward('inst-1', receipt.reward_awarded_at, 10, seen);
  assert.deepEqual(first, { key: 'inst-1:2026-11-14T15:00:00Z:10', amount: 10 });
  seen.add(first.key);
  assert.equal(claimAward('inst-1', receipt.reward_awarded_at, 10, seen), null);
});

test('optimistic completion rolls back the same row', () => {
  const rows = [{ id: 'a', status: 'available' }, { id: 'b', status: 'available' }];
  const next = withStatus(rows, 'a', 'completed');
  assert.equal(next[0].status, 'completed');
  assert.equal(rows[0].status, 'available');
  const restored = restoreRow(next, rows[0]);
  assert.equal(restored[0].status, 'available');
  assert.equal(restored[1].id, 'b');
});

test('one failed slice keeps its previous rows', () => {
  const kept = sectionSlice([{ id: 'today' }], { message: 'week down' }, null);
  assert.deepEqual(kept.rows, [{ id: 'today' }]);
  assert.equal(kept.error, 'week down');
  const fresh = sectionSlice([{ id: 'old' }], null, [{ id: 'new' }]);
  assert.deepEqual(fresh.rows, [{ id: 'new' }]);
  assert.equal(fresh.error, null);
});

test('empty copy stays one line and couple XP is never combined', () => {
  assert.equal(emptyCopy('today', 'partner'), 'Nothing from your partner today.');
  assert.equal(emptyCopy('today', 'all'), 'Nothing open for today.');
  assert.equal(callerCoupleAward('adventurer', { awarded: true, connorXp: 11, izzyXp: 10 }), 11);
  assert.equal(callerCoupleAward('companion', { awarded: true, connorXp: 11, izzyXp: 10 }), 10);
  assert.equal(callerCoupleAward(null, { awarded: true, connorXp: 11, izzyXp: 10 }), null);
  assert.equal(callerCoupleAward('adventurer', { awarded: false, connorXp: 11, izzyXp: 10 }), null);
  assert.equal(shouldVibrate(true, 10), false);
  assert.equal(shouldVibrate(false, 10), true);
  assert.equal(shouldVibrate(false, 0), false);
});
