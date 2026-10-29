import assert from 'node:assert/strict';
import test from 'node:test';
import { FIGHT_ID, EVENT_ID, TREASURE_ID, GUARDIAN_ID } from '../lib/crypt/content.ts';
import { createRun, nodeAccess, reduceRun } from '../lib/crypt/run.ts';

function reachTreasure(seed = 17) {
  let run = reduceRun(createRun(seed), { type: 'continue' });
  run = reduceRun(run, { type: 'continue' });
  run = reduceRun(run, { type: 'open', nodeId: FIGHT_ID });
  for (let i = 0; i < 8 && run.battle?.status === 'ongoing'; i++) {
    run = reduceRun(run, { type: 'combat', action: 'attack' });
  }
  assert.equal(run.battle?.status, 'won');
  run = reduceRun(run, { type: 'continue' });
  run = reduceRun(run, { type: 'open', nodeId: EVENT_ID });
  run = reduceRun(run, { type: 'choose', choiceId: 'mend' });
  run = reduceRun(run, { type: 'continue' });
  run = reduceRun(run, { type: 'open', nodeId: TREASURE_ID });
  assert.equal(run.phase, 'treasure');
  return run;
}

test('taking the Ember Charm grants only the run-scoped damage bonus', () => {
  const start = reachTreasure();
  const taken = reduceRun(start, { type: 'choose-relic', choice: 'take' });
  assert.equal(taken.phase, 'map');
  assert.equal(taken.treasureCleared, true);
  assert.equal(taken.relicChoice, 'take');
  assert.equal(taken.attackBonus, 2);
  assert.equal(nodeAccess(taken, GUARDIAN_ID), 'ready');
  assert.equal(reduceRun(taken, { type: 'choose-relic', choice: 'leave' }), taken,
    'a second/stale choice cannot reverse the decision');
});

test('leaving the Ember Charm keeps the Sentinel accessible but removes its bonus', () => {
  const start = reachTreasure();
  const left = reduceRun(start, { type: 'choose-relic', choice: 'leave' });
  assert.equal(left.phase, 'map');
  assert.equal(left.treasureCleared, true);
  assert.equal(left.relicChoice, 'leave');
  assert.equal(left.attackBonus, 0);
  assert.equal(nodeAccess(left, GUARDIAN_ID), 'ready');
  assert.match(left.outcomeNote ?? '', /Sentinel will be harder/i);
});

test('restart clears the relic decision and all run-only bonuses', () => {
  const taken = reduceRun(reachTreasure(), { type: 'choose-relic', choice: 'take' });
  const fresh = reduceRun(taken, { type: 'restart', seed: 18 });
  assert.equal(fresh.relicChoice, null);
  assert.equal(fresh.treasureCleared, false);
  assert.equal(fresh.attackBonus, 0);
});
