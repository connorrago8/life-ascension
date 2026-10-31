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


test('defeat cannot be retried or escaped into the same run', () => {
  const run = createRun(99);
  const defeated = { ...run, phase: 'fight', encounterId: 'rat', hp: 0, battle: { status: 'lost' } };
  assert.equal(reduceRun(defeated, { type: 'back' }), defeated);
  assert.equal(reduceRun(defeated, { type: 'retry-fight' }), defeated);
  const newRun = reduceRun(defeated, { type: 'restart', seed: 100 });
  assert.equal(newRun.phase, 'intro');
  assert.equal(newRun.seed, 100);
  assert.equal(newRun.fightCleared, false);
});

test('resume preserves branching choices and does not grant a free checkpoint', () => {
  let run = createRun(314159);
  run = reduceRun(run, { type: 'continue' });
  run = reduceRun(run, { type: 'continue' });
  assert.equal(run.phase, 'map');
  const saved = serializeCryptSave(run, new Date('2026-10-31T12:00:00Z'));
  const resumed = parseCryptSave(saved)?.run;
  assert.deepEqual(resumed, run);
  assert.equal(resumed?.fightCleared, false);
  assert.equal(resumed?.guardianCleared, false);
  assert.equal(resumed?.relicChoice, null);
});

test('a defeated run survives serialization as defeated, not an automatic retry', () => {
  const run = { ...createRun(501), phase: 'fight', encounterId: 'rat', hp: 0,
    battle: { status: 'lost' } };
  const restored = parseCryptSave(serializeCryptSave(run))?.run;
  assert.equal(restored?.hp, 0);
  assert.equal(restored?.battle?.status, 'lost');
  assert.equal(reduceRun(restored, { type: 'back' }), restored);
});
