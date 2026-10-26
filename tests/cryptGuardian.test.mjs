import assert from 'node:assert/strict';
import test from 'node:test';
import { GUARDIAN_ID, FIGHT_ID, EVENT_ID, SENTINEL, SIGIL, TREASURE_ID } from '../lib/crypt/content.ts';
import { createRun, nodeAccess, reduceRun } from '../lib/crypt/run.ts';

function reachGuardian(seed = 13) {
  let run = createRun(seed);
  run = reduceRun(run, { type: 'continue' });
  run = reduceRun(run, { type: 'continue' });
  run = reduceRun(run, { type: 'open', nodeId: FIGHT_ID });
  for (let i = 0; i < 4 && run.battle?.status === 'ongoing'; i++) {
    run = reduceRun(run, { type: 'combat', action: 'attack' });
  }
  assert.equal(run.battle?.status, 'won');
  run = reduceRun(run, { type: 'continue' });
  run = reduceRun(run, { type: 'open', nodeId: EVENT_ID });
  run = reduceRun(run, { type: 'choose', choiceId: 'mend' });
  run = reduceRun(run, { type: 'continue' });
  run = reduceRun(run, { type: 'open', nodeId: TREASURE_ID });
  run = reduceRun(run, { type: 'continue' });
  assert.equal(run.phase, 'map');
  assert.equal(nodeAccess(run, GUARDIAN_ID), 'ready');
  assert.equal(run.attackBonus, 2);
  return run;
}

test('guardian is inaccessible before treasure and the door remains sealed', () => {
  const start = reduceRun(reduceRun(createRun(13), { type: 'continue' }), { type: 'continue' });
  assert.equal(nodeAccess(start, GUARDIAN_ID), 'locked');
  assert.equal(reduceRun(start, { type: 'open', nodeId: GUARDIAN_ID }), start);
  assert.equal(reduceRun(start, { type: 'continue' }), start);
  const ready = reachGuardian();
  assert.equal(reduceRun(ready, { type: 'continue' }), ready);
});

test('guardian uses a distinct deterministic fight and the charm bonus', () => {
  const ready = reachGuardian();
  const first = reduceRun(ready, { type: 'open', nodeId: GUARDIAN_ID });
  const second = reduceRun(ready, { type: 'open', nodeId: GUARDIAN_ID });
  assert.deepEqual(first.battle, second.battle);
  assert.equal(first.battle?.enemy.id, SENTINEL.id);
  assert.equal(first.battle?.enemy.hp, SENTINEL.maxHp);
  assert.equal(first.battle?.player.attackBonus, 2);
  assert.equal(first.hpAtFightStart, ready.hp);
  assert.notEqual(first.battle?.rng.seed, ready.seed);
});

test('retreat restores pre-fight HP; retry replays the encounter', () => {
  const ready = reachGuardian();
  let fight = reduceRun(ready, { type: 'open', nodeId: GUARDIAN_ID });
  const initial = fight.battle;
  fight = reduceRun(fight, { type: 'combat', action: 'defend' });
  assert.ok(fight.hp < ready.hp);
  const retreat = reduceRun(fight, { type: 'back' });
  assert.equal(retreat.phase, 'map');
  assert.equal(retreat.hp, ready.hp);
  assert.equal(retreat.guardianCleared, false);
  assert.equal(retreat.sigilCollected, false);
  assert.equal(nodeAccess(retreat, GUARDIAN_ID), 'ready');

  let lost = reduceRun(ready, { type: 'open', nodeId: GUARDIAN_ID });
  for (let i = 0; i < 15 && lost.battle?.status === 'ongoing'; i++) {
    lost = reduceRun(lost, { type: 'combat', action: 'focus' });
  }
  assert.equal(lost.battle?.status, 'lost');
  const retry = reduceRun(lost, { type: 'retry-fight' });
  assert.equal(retry.hp, ready.hp);
  assert.deepEqual(retry.battle, initial);
  assert.equal(retry.fightCleared, true, 'retrying the guardian must not reopen the rat');
  assert.equal(retry.eventCleared, true);
  assert.equal(retry.treasureCleared, true);
  assert.equal(retry.guardianCleared, false);
  assert.equal(retry.sigilCollected, false);
  const retryRetreat = reduceRun(retry, { type: 'back' });
  assert.equal(nodeAccess(retryRetreat, FIGHT_ID), 'done');
  assert.equal(nodeAccess(retryRetreat, GUARDIAN_ID), 'ready');
});

test('victory grants a temporary sigil once; restart clears it', () => {
  let run = reduceRun(reachGuardian(), { type: 'open', nodeId: GUARDIAN_ID });
  run = reduceRun(run, { type: 'combat', action: 'heavy' });
  if (run.battle?.status === 'ongoing') run = reduceRun(run, { type: 'combat', action: 'attack' });
  assert.equal(run.battle?.status, 'won');
  assert.equal(run.guardianCleared, true);
  assert.equal(run.sigilCollected, true);
  assert.equal(run.fightCleared, true, 'guardian victory must retain the first encounter clear');
  assert.equal(SIGIL.name, 'Sentinel Sigil');
  assert.equal(reduceRun(run, { type: 'retry-fight' }), run);
  run = reduceRun(run, { type: 'continue' });
  assert.equal(nodeAccess(run, GUARDIAN_ID), 'done');
  assert.equal(reduceRun(run, { type: 'open', nodeId: GUARDIAN_ID }), run);
  run = reduceRun(run, { type: 'continue' });
  assert.equal(run.phase, 'end');
  const fresh = reduceRun(run, { type: 'restart', seed: 13 });
  assert.equal(fresh.sigilCollected, false);
  assert.equal(fresh.guardianCleared, false);
  assert.equal(fresh.attackBonus, 0);
});
