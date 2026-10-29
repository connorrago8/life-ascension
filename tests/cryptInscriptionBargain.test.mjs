import assert from 'node:assert/strict';
import test from 'node:test';
import { EVENT_ID, GUARDIAN_ID, PLAYER, TREASURE_ID } from '../lib/crypt/content.ts';
import { createRun, nodeAccess, reduceRun } from '../lib/crypt/run.ts';

const send = (state, type, extra = {}) => reduceRun(state, { type, ...extra });
function inscription(seed = 1, hp = PLAYER.maxHp) {
  const ready = { ...createRun(seed), phase: 'map', fightCleared: true, hp };
  return send(ready, 'open', { nodeId: EVENT_ID });
}

test('ember bargain trades exactly two HP for one run-only attack bonus', () => {
  let state = send(inscription(11), 'choose', { choiceId: 'bargain' });
  assert.equal(state.hp, PLAYER.maxHp - 2);
  assert.equal(state.attackBonus, 1);
  assert.equal(state.eventChoiceId, 'bargain');
  assert.equal(state.eventCleared, true);
  assert.match(state.outcomeNote, /takes 2 HP/);
  state = send(state, 'continue');
  assert.equal(state.phase, 'map');
  assert.equal(nodeAccess(state, TREASURE_ID), 'ready');
  state = send(state, 'open', { nodeId: TREASURE_ID });
  state = send(state, 'continue');
  assert.equal(state.attackBonus, 3);
  assert.equal(nodeAccess(state, GUARDIAN_ID), 'ready');
  assert.equal(Object.hasOwn(state, 'xp'), false);
  assert.equal(Object.hasOwn(state, 'inventory'), false);
});

test('bargain cannot reduce HP below one and cannot be collected twice', () => {
  let state = send(inscription(9, 1), 'choose', { choiceId: 'bargain' });
  assert.equal(state.hp, 1);
  assert.match(state.outcomeNote, /takes 0 HP/);
  assert.equal(state.attackBonus, 1);
  assert.strictEqual(send(state, 'choose', { choiceId: 'bargain' }), state);
  state = send(state, 'continue');
  assert.equal(nodeAccess(state, EVENT_ID), 'done');
  assert.strictEqual(send(state, 'open', { nodeId: EVENT_ID }), state);
});

test('mending and warning choices retain previous mechanics', () => {
  const mend = send(inscription(2, 14), 'choose', { choiceId: 'mend' });
  assert.equal(mend.hp, 16);
  assert.equal(mend.attackBonus, 0);
  const warning = send(inscription(2), 'choose', { choiceId: 'warning' });
  assert.equal(warning.hp, PLAYER.maxHp);
  assert.match(warning.hint, /door is sealed/);
  assert.equal(warning.attackBonus, 0);
});

test('bargain is unsaved and resets on restart', () => {
  const bargain = send(inscription(3), 'choose', { choiceId: 'bargain' });
  const restarted = send(bargain, 'restart', { seed: 4 });
  assert.equal(restarted.attackBonus, 0);
  assert.equal(restarted.hp, PLAYER.maxHp);
  assert.equal(restarted.eventCleared, false);
  assert.equal(restarted.eventChoiceId, null);
});
