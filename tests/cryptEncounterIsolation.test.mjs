import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const screen = readFileSync(new URL('../components/crypt/CryptRun.tsx', import.meta.url), 'utf8');
const runSource = readFileSync(new URL('../lib/crypt/run.ts', import.meta.url), 'utf8');

function balancedBlock(source, marker) {
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, 'missing ' + marker);
  const brace = source.indexOf('{', start);
  let depth = 0;
  for (let i = brace; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  assert.fail('unbalanced ' + marker);
}

const dispatcherSource = balancedBlock(screen, 'function dispatch(')
  .replace('function dispatch(command: RunCommand, expectedPhase?: Phase)',
    'function dispatch(command, expectedPhase)');

const runReducer = new Function('state', 'command', 'act', 'startBattle', 'FIGHT_ID', 'GUARDIAN_ID',
  balancedBlock(runSource, "if (command.type === 'continue')") + '\n' +
  balancedBlock(runSource, "if (command.type === 'combat')") + '\n' +
  balancedBlock(runSource, "if (command.type === 'retry-fight')") + '\nreturn state;');

function reducer(state, command) {
  return runReducer(state, command,
    (battle) => ({ ...battle, turn: battle.turn + 1 }),
    (next) => ({ status: 'ongoing', turn: 1, player: { hp: next.hp } }),
    'fight-rat', 'fight-sentinel');
}

function fight(encounterId, status = 'ongoing') {
  return {
    seed: 77, phase: 'fight', encounterId, fightAttempt: 1, maxHp: 20, hp: 20, hpAtFightStart: 20,
    fightCleared: encounterId === 'fight-sentinel', guardianCleared: false,
    sigilCollected: false,
    battle: { status, turn: 1, player: { hp: 20 } },
  };
}

function queued(rendered, active, commands) {
  const queue = [];
  const dispatch = new Function('setRun', 'reduceRun', 'run', dispatcherSource + '\nreturn dispatch;')(
    (update) => queue.push(update), reducer, rendered);
  for (const [command, expectedPhase] of commands) dispatch(command, expectedPhase);
  return queue.reduce((current, update) => update(current), active);
}

test('old rat combat callback cannot advance a later Sentinel encounter', () => {
  const guardian = fight('fight-sentinel');
  const after = queued(fight('fight-rat'), guardian, [[{ type: 'combat', action: 'attack' }]]);
  assert.equal(after.battle.turn, guardian.battle.turn);
  assert.equal(after.encounterId, 'fight-sentinel');
});

test('old rat victory Continue cannot dismiss a later Sentinel victory', () => {
  const guardian = fight('fight-sentinel', 'won');
  const after = queued(fight('fight-rat', 'won'), guardian, [[{ type: 'continue' }, 'fight']]);
  assert.equal(after.phase, 'fight');
  assert.equal(after.battle.status, 'won');
});

test('old rat Retry cannot reset a later Sentinel defeat', () => {
  const guardian = fight('fight-sentinel', 'lost');
  const after = queued(fight('fight-rat', 'lost'), guardian, [[{ type: 'retry-fight' }, 'fight']]);
  assert.equal(after.battle.status, 'lost');
});

test('two rapid actions within the same encounter still resolve sequentially', () => {
  const rat = fight('fight-rat');
  const after = queued(rat, rat, [
    [{ type: 'combat', action: 'attack' }],
    [{ type: 'combat', action: 'defend' }],
  ]);
  assert.equal(after.battle.turn, 3);
});

test('current Sentinel victory Continue remains usable', () => {
  const guardian = fight('fight-sentinel', 'won');
  const after = queued(guardian, guardian, [[{ type: 'continue' }, 'fight']]);
  assert.equal(after.phase, 'map');
});

test('dispatcher binds fight actions to their originating encounter', () => {
  assert.ok(screen.includes('const originEncounterId = run?.encounterId;'));
  assert.ok(screen.includes("command.type === 'combat' || command.type === 'retry-fight'"));
  assert.ok(screen.includes('current.encounterId !== originEncounterId'));
});

test('stale combat callback cannot act after Retry of the same Rat encounter', () => {
  const previous = fight('fight-rat', 'lost');
  const retried = { ...fight('fight-rat'), fightAttempt: 2 };
  const after = queued(previous, retried, [[{ type: 'combat', action: 'attack' }]]);
  assert.equal(after.battle.turn, retried.battle.turn);
  assert.equal(after.fightAttempt, 2);
});

test('stale defeat Back cannot dismiss a newer retry of the same encounter', () => {
  const previous = fight('fight-sentinel', 'lost');
  const retried = { ...fight('fight-sentinel'), fightAttempt: 2 };
  const after = queued(previous, retried, [[{ type: 'back' }, 'fight']]);
  assert.equal(after.phase, 'fight');
  assert.equal(after.fightAttempt, 2);
});

test('stale victory Continue cannot dismiss a newer attempt of the same encounter', () => {
  const previous = fight('fight-rat', 'won');
  const retried = { ...fight('fight-rat'), fightAttempt: 2 };
  const after = queued(previous, retried, [[{ type: 'continue' }, 'fight']]);
  assert.equal(after.phase, 'fight');
  assert.equal(after.fightAttempt, 2);
});
