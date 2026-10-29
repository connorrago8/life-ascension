import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FIGHT_ID, EVENT_ID, TREASURE_ID, GUARDIAN_ID, SENTINEL, SIGIL,
} from '../lib/crypt/content.ts';
import { createRun, nodeAccess, reduceRun } from '../lib/crypt/run.ts';

/** Exercise the real reducer and battle engine, not a mocked simulator. */
function command(run, type, more = {}) {
  return reduceRun(run, { type, ...more });
}

function finishRat(run, label) {
  assert.equal(nodeAccess(run, FIGHT_ID), 'ready', label);
  run = command(run, 'open', { nodeId: FIGHT_ID });
  assert.equal(run.phase, 'fight', label);
  run = command(run, 'combat', { action: 'heavy' });
  if (run.battle?.status === 'ongoing') {
    run = command(run, 'combat', { action: 'attack' });
  }
  assert.equal(run.battle?.status, 'won', label);
  assert.equal(run.fightCleared, true, label);
  assert.equal(run.guardianCleared, false, label);
  assert.equal(run.sigilCollected, false, label);
  return command(run, 'continue');
}

function finishGuardian(run, label) {
  assert.equal(nodeAccess(run, GUARDIAN_ID), 'ready', label);
  run = command(run, 'open', { nodeId: GUARDIAN_ID });
  assert.equal(run.phase, 'fight', label);
  assert.equal(run.battle?.enemy.id, SENTINEL.id, label);
  assert.equal(run.battle?.player.attackBonus, 2, label);
  run = command(run, 'combat', { action: 'heavy' });
  if (run.battle?.status === 'ongoing') {
    run = command(run, 'combat', { action: 'attack' });
  }
  assert.equal(run.battle?.status, 'won', label);
  assert.equal(run.guardianCleared, true, label);
  assert.equal(run.sigilCollected, true, label);
  assert.equal(run.fightCleared, true, label);
  assert.strictEqual(command(run, 'combat', { action: 'attack' }), run, 'no post-victory turns');
  assert.strictEqual(command(run, 'retry-fight'), run, 'no post-victory retry');
  return command(run, 'continue');
}

/**
 * Every seeded route must reach the ending with a run-only Sigil.
 * The two inscription branches must not grant each other's clue,
 * and no RPG-only action may create account XP or permanent ownership.
 */
test('Forgotten Crypt completes reproducibly across seeds and both inscription choices', async (t) => {
  for (let seed = 1; seed <= 32; seed += 1) {
    for (const choiceId of ['mend', 'warning']) {
      await t.test(`seed ${seed}, ${choiceId}`, () => {
        const label = `seed ${seed} / ${choiceId}`;
        let run = createRun(seed);
        assert.equal(run.phase, 'intro', label);
        assert.equal(nodeAccess(run, GUARDIAN_ID), 'locked', label);
        assert.strictEqual(command(run, 'open', { nodeId: GUARDIAN_ID }), run);
        run = command(command(run, 'continue'), 'continue');
        assert.equal(run.phase, 'map', label);
        run = finishRat(run, label);
        assert.equal(run.phase, 'map', label);
        assert.equal(nodeAccess(run, EVENT_ID), 'ready', label);
        run = command(run, 'open', { nodeId: EVENT_ID });
        run = command(run, 'choose', { choiceId });
        assert.equal(run.eventChoiceId, choiceId, label);
        assert.equal(run.eventCleared, true, label);
        if (choiceId === 'warning') {
          assert.match(run.hint ?? '', /broken compass/i, label);
        } else {
          assert.equal(run.hint, null, label);
        }
        run = command(run, 'continue');
        assert.equal(run.phase, 'map', label);
        run = command(run, 'open', { nodeId: TREASURE_ID });
        assert.equal(run.phase, 'treasure', label);
        run = command(run, 'continue');
        assert.equal(run.treasureCleared, true, label);
        assert.equal(run.attackBonus, 2, label);
        assert.equal(run.phase, 'map', label);
        run = finishGuardian(run, label);
        assert.equal(run.phase, 'map', label);
        assert.equal(nodeAccess(run, GUARDIAN_ID), 'done', label);
        assert.equal(SIGIL.name, 'Sentinel Sigil');
        assert.equal(Object.hasOwn(run, 'xp'), false, label);
        assert.equal(Object.hasOwn(run, 'inventory'), false, label);
        run = command(run, 'continue');
        assert.equal(run.phase, 'end', label);
        assert.equal(run.sigilCollected, true, label);
        assert.equal(Object.hasOwn(run, 'xp'), false, label);
        const fresh = command(run, 'restart', { seed });
        assert.equal(fresh.phase, 'intro', label);
        assert.equal(fresh.sigilCollected, false, label);
        assert.equal(fresh.attackBonus, 0, label);
        assert.equal(fresh.guardianCleared, false, label);
        assert.equal(fresh.treasureCleared, false, label);
        assert.equal(fresh.hint, null, label);
        assert.equal(Object.hasOwn(fresh, 'xp'), false, label);
      });
    }
  }
});
