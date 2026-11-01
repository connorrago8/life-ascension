import test from 'node:test';
import assert from 'node:assert/strict';
import { createLatestCharacterLoadGate } from '../lib/preview/latestCharacterLoadGate.ts';

test('a newer character load prevents an older response from committing', () => {
  const gate = createLatestCharacterLoadGate();
  const olderCanCommit = gate.begin();
  const newerCanCommit = gate.begin();
  assert.equal(olderCanCommit(), false);
  assert.equal(newerCanCommit(), true);
});

test('invalidating pending loads prevents stale responses from restoring old gear or XP', () => {
  const gate = createLatestCharacterLoadGate();
  const pendingCanCommit = gate.begin();
  gate.invalidate();
  assert.equal(pendingCanCommit(), false);
  assert.equal(gate.begin()(), true);
});

test('only the most recent of multiple overlapping loads remains current', () => {
  const gate = createLatestCharacterLoadGate();
  const checks = Array.from({ length: 25 }, () => gate.begin());
  assert.deepEqual(checks.map(check => check()), [...Array(24).fill(false), true]);
});
