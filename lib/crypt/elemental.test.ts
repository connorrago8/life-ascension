import assert from 'node:assert/strict';
import test from 'node:test';
import { STARTER_ABILITIES } from './abilities.ts';
import { resolveElementalTurn } from './elemental.ts';

const initial = { playerHp: 20, enemyHp: 20, enemyAttack: 5, burn: 0, chill: 0 };

test('Fire pressures the enemy with persistent burn', () => {
  const first = resolveElementalTurn(initial, STARTER_ABILITIES[0]);
  assert.equal(first.state.enemyHp, 15); // 4 direct + 1 burn
  assert.equal(first.state.playerHp, 15);
  assert.equal(first.state.burn, 1);
  const second = resolveElementalTurn(first.state, STARTER_ABILITIES[0]);
  assert.equal(second.state.enemyHp, 9); // 4 direct + 2 burn
  assert.equal(second.state.burn, 2);
});

test('Ice reduces the next enemy attack without persisting chill', () => {
  const result = resolveElementalTurn(initial, STARTER_ABILITIES[1]);
  assert.equal(result.state.enemyHp, 17);
  assert.equal(result.state.playerHp, 16);
  assert.equal(result.state.chill, 0);
});

test('A defeated enemy cannot retaliate', () => {
  const result = resolveElementalTurn({ ...initial, enemyHp: 3 }, STARTER_ABILITIES[0]);
  assert.equal(result.state.playerHp, 20);
  assert.equal(result.damageTaken, 0);
});

test('Effects are deterministic and do not mutate inputs', () => {
  const copy = structuredClone(initial);
  const a = resolveElementalTurn(initial, STARTER_ABILITIES[0]);
  const b = resolveElementalTurn(initial, STARTER_ABILITIES[0]);
  assert.deepEqual(a, b);
  assert.deepEqual(initial, copy);
});

test('Invalid state is rejected', () => {
  assert.throws(() => resolveElementalTurn({ ...initial, enemyAttack: -1 }, STARTER_ABILITIES[0]));
});
