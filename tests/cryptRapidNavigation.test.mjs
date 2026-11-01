import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const screen = readFileSync(new URL('../components/crypt/CryptRun.tsx', import.meta.url), 'utf8');
const run = readFileSync(new URL('../lib/crypt/run.ts', import.meta.url), 'utf8');

function balancedBlock(source, marker) {
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, 'missing ' + marker);
  const brace = source.indexOf('{', start);
  assert.notEqual(brace, -1);
  let depth = 0;
  for (let index = brace; index < source.length; index++) {
    if (source[index] === '{') depth++;
    if (source[index] === '}' && --depth === 0) return source.slice(start, index + 1);
  }
  assert.fail('unbalanced ' + marker);
}

const reducer = new Function('state', 'command',
  balancedBlock(run, "if (command.type === 'continue')") + '\n' +
  balancedBlock(run, "if (command.type === 'back')") + '\nreturn state;');
const dispatcherSource = balancedBlock(screen, 'function dispatch(')
  .replace('function dispatch(command: RunCommand, expectedPhase?: Phase)', 'function dispatch(command, expectedPhase)');

function twoRapidTaps(state, command, phase) {
  const queue = [];
  const dispatch = new Function('setRun', 'reduceRun', 'run', dispatcherSource + '\nreturn dispatch;')(
    (update) => queue.push(update), reducer, state,
  );
  dispatch(command, phase);
  dispatch(command, phase);
  return queue.reduce((current, update) => update(current), state);
}

test('double Continue from intro does not skip the gate story', () => {
  assert.equal(twoRapidTaps({ phase: 'intro', guardianCleared: false }, { type: 'continue' }, 'intro').phase, 'gate');
});

test('double Continue after Sentinel victory does not skip the sealed-door map', () => {
  const won = { phase: 'fight', battle: { status: 'won' }, guardianCleared: true, encounterId: 'guardian', outcomeNote: null };
  assert.equal(twoRapidTaps(won, { type: 'continue' }, 'fight').phase, 'map');
});

test('double Back from map does not skip the gate', () => {
  assert.equal(twoRapidTaps({ phase: 'map', guardianCleared: false }, { type: 'back' }, 'map').phase, 'gate');
});

test('rapid combat taps still resolve sequentially from current state', () => {
  const queue = [];
  const dispatch = new Function('setRun', 'reduceRun', 'run', dispatcherSource + '\nreturn dispatch;')(
    (update) => queue.push(update),
    (current, command) => command.type === 'combat' ? { ...current, turns: current.turns + 1 } : current,
    { phase: 'fight', seed: 17, turns: 0 },
  );
  assert.match(screen, /onAction=\{\(action\) => dispatch\(\{ type: 'combat', action \}\)\}/);
  dispatch({ type: 'combat', action: 'attack' });
  dispatch({ type: 'combat', action: 'attack' });
  assert.equal(queue.reduce((current, update) => update(current), { phase: 'fight', seed: 17, turns: 0 }).turns, 2);
});

test('all five remaining Continue controls carry their rendered-phase guard', () => {
  assert.equal(screen.split("dispatch({ type: 'continue' }, run.phase)").length - 1, 5);
});


test('stale Continue from the old intro cannot advance a newly restarted run', () => {
  const original = { phase: 'intro', seed: 101, guardianCleared: false };
  const fresh = { ...original, seed: 202 };
  const queue = [fresh]; // Restart was queued before the old button callback.
  const dispatch = new Function('setRun', 'reduceRun', 'run', dispatcherSource + '\nreturn dispatch;')(
    (update) => queue.push(update), reducer, original,
  );
  dispatch({ type: 'continue' }, 'intro');
  const next = queue.reduce((current, update) => typeof update === 'function' ? update(current) : update, original);
  assert.equal(next.seed, fresh.seed);
  assert.equal(next.phase, 'intro');
});

test('Continue on the current run still opens the gate', () => {
  const original = { phase: 'intro', seed: 101, guardianCleared: false };
  const queue = [];
  const dispatch = new Function('setRun', 'reduceRun', 'run', dispatcherSource + '\nreturn dispatch;')(
    (update) => queue.push(update), reducer, original,
  );
  dispatch({ type: 'continue' }, 'intro');
  assert.equal(queue.reduce((current, update) => update(current), original).phase, 'gate');
});
