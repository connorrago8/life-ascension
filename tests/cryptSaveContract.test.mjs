import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, reduceRun } from '../lib/crypt/run.ts';
import { parseCryptSave, serializeCryptSave } from '../lib/crypt/saveContract.ts';

test('Crypt save round-trips seed and progress without rerolling', () => {
  const initial = createRun(12345);
  const run = reduceRun(reduceRun(initial, { type: 'continue' }), { type: 'continue' });
  const saved = serializeCryptSave(run, new Date('2026-10-31T12:00:00Z'));
  const restored = parseCryptSave(saved);
  assert.deepEqual(restored?.run, run);
  assert.equal(restored?.version, 1);
});

test('malformed and incompatible saves fail closed', () => {
  assert.equal(parseCryptSave('{'), null);
  const good = JSON.parse(serializeCryptSave(createRun(5)));
  assert.equal(parseCryptSave(JSON.stringify({ ...good, version: 2 })), null);
  assert.equal(parseCryptSave(JSON.stringify({ ...good, run: { ...good.run, hp: 99999 } })), null);
  assert.equal(parseCryptSave(JSON.stringify({ ...good, run: { ...good.run, phase: 'fight' } })), null);
  assert.equal(parseCryptSave(JSON.stringify({ ...good, run: { ...good.run, seed: -1 } })), null);
});
