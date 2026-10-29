import assert from 'node:assert/strict';
import test from 'node:test';
import { EVENT_ID, GUARDIAN_ID, PLAYER, TREASURE_ID, eventNode, charmNote } from '../lib/crypt/content.ts';
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

test('bargain refuses an unaffordable offering and cannot be collected twice', () => {
  let state = send(inscription(9, 1), 'choose', { choiceId: 'bargain' });
  assert.equal(state.hp, 1);
  assert.match(state.outcomeNote, /need more than 2 HP/);
  assert.equal(state.attackBonus, 0);
  assert.equal(state.eventCleared, false);
  assert.equal(state.eventChoiceId, null);
  assert.strictEqual(send(state, 'continue'), state, 'cannot advance without choosing');
  state = send(state, 'choose', { choiceId: 'warning' });
  assert.equal(state.eventCleared, true);
  assert.equal(state.eventChoiceId, 'warning');
  assert.match(state.hint, /door is sealed/);
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

test('the ember bargain has an exact survivable HP boundary', () => {
  for (const hp of [1, 2]) {
    const declined = send(inscription(7, hp), 'choose', { choiceId: 'bargain' });
    assert.equal(declined.hp, hp);
    assert.equal(declined.attackBonus, 0);
    assert.equal(declined.eventCleared, false);
    assert.match(declined.outcomeNote, /need more than 2 HP/);
  }
  const accepted = send(inscription(7, 3), 'choose', { choiceId: 'bargain' });
  assert.equal(accepted.hp, 1);
  assert.equal(accepted.attackBonus, 1);
  assert.match(accepted.outcomeNote, /takes 2 HP/);
});

test('ember bargain progression and bonus remain deterministic across 32 seeds', () => {
  for (let seed = 1; seed <= 32; seed++) {
    let state = send(inscription(seed, 12), 'choose', { choiceId: 'bargain' });
    assert.equal(state.hp, 10, 'seed ' + seed);
    assert.equal(state.attackBonus, 1, 'seed ' + seed);
    state = send(state, 'continue');
    state = send(state, 'open', { nodeId: TREASURE_ID });
    state = send(state, 'continue');
    assert.equal(state.attackBonus, 3, 'seed ' + seed);
    assert.equal(nodeAccess(state, GUARDIAN_ID), 'ready', 'seed ' + seed);
    assert.equal(Object.hasOwn(state, 'xp'), false);
    assert.equal(Object.hasOwn(state, 'inventory'), false);
  }
});

test('declined offering keeps alternate mending choice available', () => {
  let state = send(inscription(13, 2), 'choose', { choiceId: 'bargain' });
  assert.equal(state.eventCleared, false);
  state = send(state, 'choose', { choiceId: 'mend' });
  assert.equal(state.hp, 4);
  assert.equal(state.attackBonus, 0);
  assert.equal(state.eventChoiceId, 'mend');
  assert.equal(state.eventCleared, true);
  assert.match(state.outcomeNote, /recover 2 HP/);
  state = send(state, 'continue');
  assert.equal(nodeAccess(state, TREASURE_ID), 'ready');
});

test('bargain bonus reaches the actual Sentinel combatant and is not awarded twice', () => {
  let state = send(inscription(19, 12), 'choose', { choiceId: 'bargain' });
  state = send(state, 'continue');
  state = send(state, 'open', { nodeId: TREASURE_ID });
  state = send(state, 'continue');
  assert.equal(state.attackBonus, 3);
  state = send(state, 'open', { nodeId: GUARDIAN_ID });
  assert.equal(state.phase, 'fight');
  assert.equal(state.battle.player.attackBonus, 3);
  assert.equal(state.battle.player.hp, 10);
  assert.equal(state.battle.enemy.id, 'crypt-sentinel');
  const firstAttempt = state.fightAttempt;
  const retreated = send(state, 'back');
  assert.equal(retreated.attackBonus, 3);
  state = send(retreated, 'open', { nodeId: GUARDIAN_ID });
  assert.equal(state.battle.player.attackBonus, 3);
  assert.equal(state.fightAttempt, firstAttempt + 1);
  assert.equal(state.treasureCleared, true);
  assert.equal(state.eventCleared, true);
});

test('inscription copy advertises three choices and final bonus credits both sources', () => {
  assert.equal(eventNode().choices.length, 3);
  assert.match(eventNode().prose, /Three lines/);
  assert.match(charmNote(3), /run-only damage bonus is \+3/);
  assert.doesNotMatch(charmNote(3), /Ember Charm adds \+3/);
});

test('Sentinel defeat and retry restore HP without duplicating the bargain or charm', () => {
  let state = send(inscription(23, 3), 'choose', { choiceId: 'bargain' });
  assert.equal(state.hp, 1);
  state = send(state, 'continue');
  state = send(state, 'open', { nodeId: TREASURE_ID });
  state = send(state, 'continue');
  state = send(state, 'open', { nodeId: GUARDIAN_ID });
  assert.equal(state.battle.player.hp, 1);
  assert.equal(state.battle.player.attackBonus, 3);
  state = send(state, 'combat', { action: 'defend' });
  assert.equal(state.battle.status, 'lost');
  const attempt = state.fightAttempt;
  state = send(state, 'retry-fight');
  assert.equal(state.phase, 'fight');
  assert.equal(state.hp, PLAYER.maxHp);
  assert.equal(state.battle.player.hp, PLAYER.maxHp);
  assert.equal(state.attackBonus, 3);
  assert.equal(state.battle.player.attackBonus, 3);
  assert.equal(state.fightAttempt, attempt + 1);
  assert.equal(state.eventChoiceId, 'bargain');
  assert.equal(state.treasureCleared, true);
  assert.equal(Object.hasOwn(state, 'xp'), false);
});
