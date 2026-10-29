import test from 'node:test';
import assert from 'node:assert/strict';
import { createLatestCharacterLoadGate } from '../lib/preview/latestCharacterLoadGate.ts';

const deferred = () => {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
};

async function settleRead(gate, request, commits, value) {
  const isCurrent = gate.begin();
  const result = await request.promise;
  if (isCurrent()) commits.push({ value, result });
}

test('slow focus response cannot overwrite a newer verified server response', async () => {
  const gate = createLatestCharacterLoadGate();
  const old = deferred(), latest = deferred(), commits = [];
  const oldDone = settleRead(gate, old, commits, 'old-gear');
  const latestDone = settleRead(gate, latest, commits, 'equipped-gear');
  latest.resolve({ equipped: true });
  await latestDone;
  old.resolve({ equipped: false });
  await oldDone;
  assert.deepEqual(commits, [{ value: 'equipped-gear', result: { equipped: true } }]);
});

test('equip invalidation rejects a delayed pre-mutation response until authoritative reload', async () => {
  const gate = createLatestCharacterLoadGate();
  const before = deferred(), after = deferred(), commits = [];
  const beforeDone = settleRead(gate, before, commits, 'pre-equip');
  gate.invalidate();
  before.resolve({ equipped: false });
  await beforeDone;
  assert.deepEqual(commits, []);
  const afterDone = settleRead(gate, after, commits, 'server-confirmed');
  after.resolve({ equipped: true });
  await afterDone;
  assert.deepEqual(commits, [{ value: 'server-confirmed', result: { equipped: true } }]);
});

test('unmount invalidation prevents an outstanding request from committing', async () => {
  const gate = createLatestCharacterLoadGate();
  const pending = deferred(), commits = [];
  const done = settleRead(gate, pending, commits, 'after-unmount');
  gate.invalidate();
  pending.resolve({ xp: 10 });
  await done;
  assert.deepEqual(commits, []);
});
