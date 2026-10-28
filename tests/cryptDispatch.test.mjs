import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { FIGHT_ID } from '../lib/crypt/content.ts';
import { createRun, reduceRun } from '../lib/crypt/run.ts';

const source = readFileSync(new URL('../components/crypt/CryptRun.tsx', import.meta.url), 'utf8');

test('Crypt actions use functional state updates rather than stale render snapshots', () => {
  assert.match(source, /function dispatch\(command: RunCommand\)/);
  assert.match(source, /setRun\(\(current\) => current \? reduceRun\(current, command\) : current\)/);
  assert.doesNotMatch(source, /setRun\(reduceRun\(run,/);
  assert.match(source, /onAction=\{\(action\) => dispatch\(\{ type: 'combat', action \}\)\}/);
  assert.match(source, /onClick=\{\(\) => dispatch\(\{ type: 'open', nodeId: node\.id \}\)\}/);
  assert.match(source, /onRetry=\{\(\) => dispatch\(\{ type: 'retry-fight' \}\)\}/);
});

test('two sequential combat actions advance two turns when applied to current state', () => {
  let state = createRun(13);
  state = reduceRun(state, { type: 'continue' });
  state = reduceRun(state, { type: 'continue' });
  state = reduceRun(state, { type: 'open', nodeId: FIGHT_ID });
  assert.equal(state.battle?.turn, 1);
  // A stale state snapshot would lose one of these updates in a batched React render.
  state = reduceRun(state, { type: 'combat', action: 'defend' });
  assert.equal(state.battle?.turn, 2);
  state = reduceRun(state, { type: 'combat', action: 'defend' });
  assert.equal(state.battle?.turn, 3);
  assert.equal(state.battle?.log.filter((line) => line.includes('braces.')).length, 2);
});
