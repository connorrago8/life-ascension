import assert from 'node:assert/strict';
import test from 'node:test';
import { FIGHT_ID, EVENT_ID, TREASURE_ID, GUARDIAN_ID, PLAYER } from '../lib/crypt/content.ts';
import { createRun, nodeAccess, reduceRun } from '../lib/crypt/run.ts';

const send = (state, type, extra = {}) => reduceRun(state, { type, ...extra });

function lose(state) {
  for (let turn = 0; turn < 25 && state.battle?.status === 'ongoing'; turn++) {
    state = send(state, 'combat', { action: 'focus' });
  }
  assert.equal(state.battle?.status, 'lost');
  assert.equal(state.hp, 0);
  return state;
}

function retreatAndReenter(state, encounterId) {
  const priorAttempt = state.fightAttempt;
  const escaped = send(state, 'back');
  assert.equal(escaped.phase, 'map');
  assert.equal(escaped.hp, PLAYER.maxHp);
  assert.equal(escaped.battle, null);
  assert.equal(nodeAccess(escaped, encounterId), 'ready');
  const reopened = send(escaped, 'open', { nodeId: encounterId });
  assert.equal(reopened.phase, 'fight');
  assert.equal(reopened.fightAttempt, priorAttempt + 1);
  assert.equal(reopened.battle?.player.hp, PLAYER.maxHp);
  return reopened;
}

function win(state) {
  state = send(state, 'combat', { action: 'heavy' });
  for (let turn = 0; turn < 5 && state.battle?.status === 'ongoing'; turn++) {
    state = send(state, 'combat', { action: 'attack' });
  }
  assert.equal(state.battle?.status, 'won');
  return send(state, 'continue');
}

test('Back after defeat reopens both encounters without softlocking run progress', async t => {
  for (let seed = 1; seed <= 32; seed++) {
    await t.test(`seed ${seed}`, () => {
      let run = send(send(createRun(seed), 'continue'), 'continue');
      run = retreatAndReenter(lose(send(run, 'open', { nodeId: FIGHT_ID })), FIGHT_ID);
      run = win(run);
      assert.equal(run.fightCleared, true);
      run = send(run, 'open', { nodeId: EVENT_ID });
      run = send(run, 'choose', { choiceId: 'mend' });
      run = send(run, 'continue');
      run = send(run, 'open', { nodeId: TREASURE_ID });
      run = send(run, 'continue');
      assert.equal(run.attackBonus, 2);
      run = lose(send(run, 'open', { nodeId: GUARDIAN_ID }));
      assert.equal(run.sigilCollected, false);
      run = retreatAndReenter(run, GUARDIAN_ID);
      assert.equal(run.fightCleared, true);
      assert.equal(run.eventCleared, true);
      assert.equal(run.treasureCleared, true);
      assert.equal(run.attackBonus, 2);
      run = win(run);
      assert.equal(run.guardianCleared, true);
      assert.equal(run.sigilCollected, true);
      run = send(run, 'continue');
      assert.equal(run.phase, 'end');
      assert.equal(Object.hasOwn(run, 'xp'), false);
      assert.equal(Object.hasOwn(run, 'inventory'), false);
    });
  }
});
