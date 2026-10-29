import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { GUARDIAN_ID, FIGHT_ID, EVENT_ID, SENTINEL, SIGIL, COMBAT, TREASURE_ID, charmNote } from '../lib/crypt/content.ts';
import { createRun, nodeAccess, reduceRun } from '../lib/crypt/run.ts';
import { act, createBattle } from '../lib/crypt/engine.ts';

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
  assert.equal(first.fightCleared, true);
  assert.equal(first.battle?.enemy.hp, SENTINEL.maxHp);
  assert.equal(first.battle?.player.attackBonus, 2);
  assert.equal(first.hpAtFightStart, ready.hp);
  assert.notEqual(first.battle?.rng.seed, ready.seed);
});

test('retreat restores pre-fight HP; retry replays the encounter', () => {
  const ready = reachGuardian();
  let fight = reduceRun(ready, { type: 'open', nodeId: GUARDIAN_ID });
  const initial = fight.battle;
  assert.equal(reduceRun(fight, { type: 'retry-fight' }), fight, 'an active battle cannot be restarted by a retry command');
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
  assert.equal(retry.hp, ready.maxHp);
  assert.equal(retry.hpAtFightStart, ready.maxHp);
  assert.equal(retry.battle?.player.hp, ready.maxHp);
  assert.equal(retry.battle?.enemy.hp, initial.enemy.hp);
  assert.deepEqual(retry.battle?.rng, initial.rng);
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

test('guardian introduction identifies the sentinel rather than the rat', () => {
  assert.match(COMBAT.guardianOpening, /Crypt Sentinel/);
  assert.doesNotMatch(COMBAT.guardianOpening, /Crypt Rat/);
});

test('sentinel combat visibly discloses its temporary Ember Charm damage bonus', () => {
  const fight = reduceRun(reachGuardian(), { type: 'open', nodeId: GUARDIAN_ID });
  assert.equal(fight.battle?.player.attackBonus, 2);
  assert.match(charmNote(fight.battle.player.attackBonus), /run-only damage bonus is \+2.*Focus doubles Attack/);
  const combatView = readFileSync(new URL('../components/crypt/CombatView.tsx', import.meta.url), 'utf8');
  assert.match(combatView, /battle\.player\.attackBonus > 0/);
  assert.match(combatView, /charmNote\(battle\.player\.attackBonus\)/);
  assert.doesNotMatch(charmNote(2), /XP|owned|permanent/i);
});


test('Ember Charm base bonus is doubled by Focus, matching visible combat guidance', () => {
  const fight = reduceRun(reachGuardian(), { type: 'open', nodeId: GUARDIAN_ID });
  assert.equal(fight.battle?.player.attackBonus, 2);
  const initial = createBattle({
    script: [0, 0, 0],
    player: fight.battle.player,
    enemy: fight.battle.enemy,
  });
  const focused = act(act(initial, 'focus'), 'attack');
  assert.equal(focused.enemy.hp, SENTINEL.maxHp - 12, 'Focus doubles (4 Attack + 2 Charm)');
  assert.match(focused.log.join(' '), /focused strike for 12/);
  assert.match(charmNote(2), /Focus doubles Attack/);
  assert.doesNotMatch(charmNote(2), /XP|permanent|owned/i);
});

test('low-HP guardian loss retries at full health without resetting prior clears or charm', () => {
  let run = createRun(1);
  run = reduceRun(reduceRun(run, { type: 'continue' }), { type: 'continue' });
  run = reduceRun(run, { type: 'open', nodeId: FIGHT_ID });
  for (let i = 0; i < 7; i++) run = reduceRun(run, { type: 'combat', action: 'defend' });
  assert.equal(run.hp, 4, 'seeded rat defense path leaves 4 HP');
  run = reduceRun(run, { type: 'combat', action: 'heavy' });
  assert.equal(run.battle?.status, 'won');
  run = reduceRun(run, { type: 'continue' });
  run = reduceRun(run, { type: 'open', nodeId: EVENT_ID });
  run = reduceRun(run, { type: 'choose', choiceId: 'warning' });
  run = reduceRun(run, { type: 'continue' });
  run = reduceRun(run, { type: 'open', nodeId: TREASURE_ID });
  run = reduceRun(run, { type: 'continue' });
  run = reduceRun(run, { type: 'open', nodeId: GUARDIAN_ID });
  assert.equal(run.hp, 4);
  assert.equal(run.attackBonus, 2);
  run = reduceRun(run, { type: 'combat', action: 'heavy' });
  assert.equal(run.battle?.status, 'lost', 'guardian survives the first blow and defeats the 4-HP player');
  const backAfterDefeat = reduceRun(run, { type: 'back' });
  assert.equal(backAfterDefeat.phase, 'map');
  assert.equal(backAfterDefeat.hp, backAfterDefeat.maxHp, 'Back after defeat must not restore an unwinnable 4-HP checkpoint');
  assert.equal(backAfterDefeat.fightCleared, true);
  assert.equal(backAfterDefeat.eventCleared, true);
  assert.equal(backAfterDefeat.treasureCleared, true);
  assert.equal(backAfterDefeat.attackBonus, 2);
  assert.equal(backAfterDefeat.sigilCollected, false);
  const reopened = reduceRun(backAfterDefeat, { type: 'open', nodeId: GUARDIAN_ID });
  assert.equal(reopened.battle?.player.hp, reopened.maxHp, 're-entering after defeat starts at full HP');
  assert.equal(reopened.battle?.enemy.hp, SENTINEL.maxHp);
  run = reduceRun(run, { type: 'retry-fight' });
  assert.equal(run.hp, run.maxHp);
  assert.equal(run.hpAtFightStart, run.maxHp);
  assert.equal(run.battle?.player.hp, run.maxHp);
  assert.equal(run.battle?.status, 'ongoing');
  assert.equal(run.fightCleared, true);
  assert.equal(run.eventCleared, true);
  assert.equal(run.treasureCleared, true);
  assert.equal(run.attackBonus, 2);
  assert.equal(run.guardianCleared, false);
  assert.equal(run.sigilCollected, false);
  assert.equal(Object.hasOwn(run, 'xp'), false);
  const retreated = reduceRun(run, { type: 'back' });
  assert.equal(retreated.hp, run.maxHp, 'retreat after retry preserves the new full-HP checkpoint');
});

test('warning clue stays readable in the field journal after inscription Continue', () => {
  let run = reduceRun(reduceRun(createRun(13), { type: 'continue' }), { type: 'continue' });
  run = reduceRun(run, { type: 'open', nodeId: FIGHT_ID });
  for (let i = 0; i < 4 && run.battle?.status === 'ongoing'; i++) {
    run = reduceRun(run, { type: 'combat', action: 'attack' });
  }
  assert.equal(run.battle?.status, 'won');
  run = reduceRun(run, { type: 'continue' });
  run = reduceRun(run, { type: 'open', nodeId: EVENT_ID });
  run = reduceRun(run, { type: 'choose', choiceId: 'warning' });
  const clue = run.hint;
  assert.match(clue, /broken compass/);
  run = reduceRun(run, { type: 'continue' });
  assert.equal(run.phase, 'map');
  assert.equal(run.outcomeNote, null, 'Continue clears the temporary event result');
  assert.equal(run.hint, clue, 'the clue is retained for later inspection');
  const view = readFileSync(new URL('../components/crypt/CryptRun.tsx', import.meta.url), 'utf8');
  assert.match(view, /run\.eventCleared \? run\.hint \?\?/);
  assert.match(view, /run\.eventChoiceId === 'warning'/);
  assert.equal(Object.hasOwn(run, 'xp'), false);
});

test('revisiting the sealed door resets the previous ending choice', () => {
  let run = reduceRun(reachGuardian(), { type: 'open', nodeId: GUARDIAN_ID });
  run = reduceRun(run, { type: 'combat', action: 'heavy' });
  if (run.battle?.status === 'ongoing') run = reduceRun(run, { type: 'combat', action: 'attack' });
  assert.equal(run.battle?.status, 'won');
  run = reduceRun(run, { type: 'continue' });
  run = reduceRun(run, { type: 'continue' });
  assert.equal(run.phase, 'end');
  run = reduceRun(run, { type: 'back' });
  assert.equal(run.phase, 'map');
  assert.equal(run.guardianCleared, true);
  assert.equal(run.sigilCollected, true);
  run = reduceRun(run, { type: 'continue' });
  assert.equal(run.phase, 'end', 'the sealed door remains reachable without replaying combat');
  const view = readFileSync(new URL('../components/crypt/CryptRun.tsx', import.meta.url), 'utf8');
  assert.match(view, /if \(run\.phase === 'end'\) setEndingChoice\(\(current\) => current\?\.seed === run\.seed \? null : current\)/, 'Back clears only the current run ending choice');
  assert.match(view, /activeEndingChoice === null \? \(/, 'both ending choices return on revisit');
  assert.equal(Object.hasOwn(run, 'xp'), false);
});

test('mending the inscription does not reveal the optional compass warning', () => {
  const run = reachGuardian();
  assert.equal(run.eventChoiceId, 'mend');
  assert.equal(run.eventCleared, true);
  assert.equal(run.hint, null, 'mending must not grant the warning-only clue');
  assert.equal(run.outcomeNote, null, 'continuing from the inscription clears its transient result');
  const view = readFileSync(new URL('../components/crypt/CryptRun.tsx', import.meta.url), 'utf8');
  assert.match(view, /<strong>Compass:<\/strong> \{run\.hint \?\? 'Its broken needle offers no clear direction yet\.'\}/);
  assert.doesNotMatch(view, /<strong>Compass:<\/strong> \{run\.treasureCleared/);
});
