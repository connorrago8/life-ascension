import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { FIGHT_ID } from '../lib/crypt/content.ts';
import { createRun, reduceRun } from '../lib/crypt/run.ts';

const source = readFileSync(new URL('../components/crypt/CryptRun.tsx', import.meta.url), 'utf8');

test('Crypt actions use functional updates with phase and run-identity guards', () => {
  assert.match(source, /function dispatch\(command: RunCommand, expectedPhase\?: Phase\)/);
  assert.match(source, /const originSeed = run\?\.seed/);
  assert.match(source, /setRun\(\(current\) => \{/);
  assert.match(source, /current\.seed !== originSeed/);
  assert.match(source, /expectedPhase && current\.phase !== expectedPhase/);
  assert.match(source, /return reduceRun\(current, command\)/);
  assert.doesNotMatch(source, /setRun\(reduceRun\(run,/);
  assert.match(source, /onAction=\{\(action\) => dispatch\(\{ type: 'combat', action \}\)\}/);
  assert.match(source, /onClick=\{\(\) => dispatch\(\{ type: 'open', nodeId: node\.id \}, run\.phase\)\}/);
  assert.match(source, /onRetry=\{\(\) => dispatch\(\{ type: 'retry-fight' \}, run\.phase\)\}/);
});

test('two sequential combat actions advance two turns when applied to current state', () => {
  let state = createRun(13);
  state = reduceRun(state, { type: 'continue' });
  state = reduceRun(state, { type: 'continue' });
  state = reduceRun(state, { type: 'open', nodeId: FIGHT_ID });
  assert.equal(state.battle?.turn, 1);
  state = reduceRun(state, { type: 'combat', action: 'defend' });
  assert.equal(state.battle?.turn, 2);
  state = reduceRun(state, { type: 'combat', action: 'defend' });
  assert.equal(state.battle?.turn, 3);
  assert.equal(state.battle?.log.filter((line) => line.includes('braces.')).length, 2);
});

function dispatcherFor(renderedRun, reducer, queue) {
  const start = source.indexOf('function dispatch(');
  const end = source.indexOf('\n  function restart()', start);
  assert.ok(start >= 0 && end > start, 'Crypt dispatcher boundaries changed');
  const runnable = source.slice(start, end)
    .replace('function dispatch(command: RunCommand, expectedPhase?: Phase)',
      'function dispatch(command, expectedPhase)');
  return new Function('setRun', 'reduceRun', 'run', runnable + '\nreturn dispatch;')(
    (update) => queue.push(update), reducer, renderedRun,
  );
}

test('stale combat callback cannot mutate a restarted Crypt run', () => {
  const oldRun = { phase: 'fight', seed: 101, turns: 0 };
  const freshRun = { ...oldRun, seed: 202 };
  const queue = [freshRun];
  const dispatch = dispatcherFor(oldRun,
    (current, command) => command.type === 'combat'
      ? { ...current, turns: current.turns + 1 } : current, queue);
  dispatch({ type: 'combat', action: 'attack' });
  const result = queue.reduce((current, update) =>
    typeof update === 'function' ? update(current) : update, oldRun);
  assert.equal(result.seed, freshRun.seed);
  assert.equal(result.turns, 0, 'Old-run combat must not advance the fresh run');
});

test('two queued combat callbacks from the same run still resolve both turns', () => {
  const run = { phase: 'fight', seed: 303, turns: 0 };
  const queue = [];
  const dispatch = dispatcherFor(run,
    (current, command) => command.type === 'combat'
      ? { ...current, turns: current.turns + 1 } : current, queue);
  dispatch({ type: 'combat', action: 'attack' });
  dispatch({ type: 'combat', action: 'defend' });
  const result = queue.reduce((current, update) => update(current), run);
  assert.equal(result.turns, 2);
});
