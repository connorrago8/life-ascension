import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createRun, reduceRun } from '../lib/crypt/run.ts';
import { FIGHT_ID } from '../lib/crypt/content.ts';

const component = readFileSync(new URL('../components/crypt/CryptRun.tsx', import.meta.url), 'utf8');
const runSource = readFileSync(new URL('../lib/crypt/run.ts', import.meta.url), 'utf8');

function balancedBlock(source, marker) {
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `missing ${marker}`);
  const brace = source.indexOf('{', start);
  let depth = 0;
  for (let i = brace; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  assert.fail(`unbalanced ${marker}`);
}

const dispatchSource = balancedBlock(component, 'function dispatch(')
  .replace('function dispatch(command: RunCommand, expectedPhase?: Phase)',
    'function dispatch(command, expectedPhase)');

function state(attempt, status = 'ongoing') {
  return {
    seed: 77, phase: 'fight', encounterId: FIGHT_ID, fightAttempt: attempt,
    hp: 20, maxHp: 20, hpAtFightStart: 20, fightCleared: false,
    battle: { status, turn: 1, player: { hp: 20 } },
  };
}

function mockReducer(current, command) {
  if (command.type === 'combat' && current.battle?.status === 'ongoing') {
    return { ...current, battle: { ...current.battle, turn: current.battle.turn + 1 } };
  }
  if (command.type === 'retry-fight' && current.battle?.status === 'lost') {
    return { ...current, fightAttempt: current.fightAttempt + 1,
      battle: { ...current.battle, status: 'ongoing', turn: 1 } };
  }
  if (command.type === 'continue' && current.battle?.status === 'won') {
    return { ...current, phase: 'map' };
  }
  return current;
}

function queued(rendered, active, commands) {
  const updates = [];
  const dispatch = new Function('setRun', 'reduceRun', 'run', dispatchSource + '\nreturn dispatch;')(
    update => updates.push(update), mockReducer, rendered);
  for (const [command, expectedPhase] of commands) dispatch(command, expectedPhase);
  return updates.reduce((current, update) => update(current), active);
}

test('stale Attack from before Retry does not advance the new attempt', () => {
  const old = state(1);
  const retried = state(2);
  assert.equal(queued(old, retried, [[{ type: 'combat', action: 'attack' }]]).battle.turn, 1);
});

test('stale Retry cannot reset a second attempt of the same encounter', () => {
  const old = state(1, 'lost');
  const second = state(2, 'lost');
  assert.deepEqual(queued(old, second, [[{ type: 'retry-fight' }, 'fight']]), second);
});

test('stale victory Continue cannot dismiss victory from a different attempt', () => {
  const old = state(1, 'won');
  const second = state(2, 'won');
  assert.deepEqual(queued(old, second, [[{ type: 'continue' }, 'fight']]), second);
});

test('two rapid actions on the current attempt still both apply', () => {
  const current = state(2);
  const after = queued(current, current, [
    [{ type: 'combat', action: 'attack' }],
    [{ type: 'combat', action: 'defend' }],
  ]);
  assert.equal(after.battle.turn, 3);
});

test('real run reducer increments attempt on encounter entry and Retry', () => {
  let run = createRun(77);
  assert.equal(run.fightAttempt, 0);
  run = reduceRun(reduceRun(run, { type: 'continue' }), { type: 'continue' });
  run = reduceRun(run, { type: 'open', nodeId: FIGHT_ID });
  assert.equal(run.fightAttempt, 1);
  for (let i = 0; i < 30 && run.battle?.status === 'ongoing'; i++) {
    run = reduceRun(run, { type: 'combat', action: 'focus' });
  }
  assert.equal(run.battle?.status, 'lost');
  const retry = reduceRun(run, { type: 'retry-fight' });
  assert.equal(retry.fightAttempt, 2);
  assert.equal(retry.seed, 77);
  assert.equal(retry.battle?.status, 'ongoing');
  assert.equal(Object.hasOwn(retry, 'xp'), false);
  assert.equal(reduceRun(retry, { type: 'retry-fight' }), retry);
});

test('run reducer has exactly three attempt increments and dispatch guards identity', () => {
  assert.equal((runSource.match(/fightAttempt: state\.fightAttempt \+ 1/g) ?? []).length, 3);
  assert.match(component, /const originFightAttempt = run\?\.fightAttempt/);
  assert.match(component, /current\.fightAttempt !== originFightAttempt/);
});
