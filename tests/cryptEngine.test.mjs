import assert from 'node:assert/strict';
import test from 'node:test';
import { SPRITES } from '../lib/crypt/art.ts';
import {
  COMBAT,
  END_CARD,
  EVENT_ID,
  FIGHT_ID,
  GUARDIAN_ID,
  HUB,
  INTRO,
  NODES,
  PLAYER,
  PREVIEW_BANNER,
  RAT,
  SENTINEL,
  SIGIL,
  TREASURE_ID,
  endCardParagraphs,
  eventNode,
  nextCryptObjective,
  treasureNode,
} from '../lib/crypt/content.ts';
import {
  ACTION_IDS,
  act,
  availableActions,
  createBattle,
  halvedDamage,
  rolledDamage,
} from '../lib/crypt/engine.ts';
import { rollAt } from '../lib/crypt/rng.ts';
import { createRun, nodeAccess, reduceRun } from '../lib/crypt/run.ts';

const player = {
  id: PLAYER.id,
  name: PLAYER.name,
  hp: PLAYER.maxHp,
  maxHp: PLAYER.maxHp,
  attack: PLAYER.attack,
  heavy: PLAYER.heavy,
  attackBonus: 0,
};

function enemy(overrides = {}) {
  return { id: RAT.id, name: RAT.name, hp: RAT.maxHp, maxHp: RAT.maxHp, attack: RAT.attack, ...overrides };
}

test('damage formulas stay in a small, even spread', () => {
  assert.equal(rolledDamage(4, 0), 4);
  assert.equal(rolledDamage(4, 0.34), 5);
  assert.equal(rolledDamage(4, 0.999), 6);
  assert.equal(halvedDamage(5), 3);
  assert.equal(halvedDamage(4), 2);
  assert.equal(halvedDamage(1), 1);
});

test('attack deals its roll and the enemy hits back', () => {
  const start = createBattle({
    script: [0, 0],
    player,
    enemy: enemy({ hp: 30, maxHp: 30, attack: 5 }),
  });
  const next = act(start, 'attack');
  assert.equal(start.player.hp, PLAYER.maxHp);
  assert.equal(start.log.length, 0);
  assert.equal(next.enemy.hp, 26);
  assert.equal(next.player.hp, 15);
  assert.match(next.log[0], /strikes for 4/);
  assert.match(next.log[1], /hits for 5/);
  assert.equal(next.status, 'ongoing');
});

test('defend halves the next hit', () => {
  const braced = act(createBattle({
    script: [0],
    player,
    enemy: enemy({ hp: 30, maxHp: 30, attack: 5 }),
  }), 'defend');
  assert.equal(braced.player.hp, 17);
  assert.match(braced.log.join(' '), /halved to 3/);
  assert.equal(braced.enemy.hp, 30);
});

test('heavy strike hits harder and then cools down for two turns', () => {
  let state = createBattle({
    script: [0, 0, 0, 0, 0, 0, 0],
    player,
    enemy: enemy({ hp: 80, maxHp: 80, attack: 1 }),
  });
  state = act(state, 'heavy');
  assert.equal(state.enemy.hp, 72);
  assert.equal(state.heavyCooldown, 2);
  assert.equal(availableActions(state).includes('heavy'), false);
  const ignored = act(state, 'heavy');
  assert.equal(ignored, state);

  state = act(state, 'attack');
  assert.equal(state.heavyCooldown, 1);
  assert.equal(availableActions(state).includes('heavy'), false);

  state = act(state, 'defend');
  assert.equal(state.heavyCooldown, 0);
  assert.equal(availableActions(state).includes('heavy'), true);
});

test('focus doubles the next attack and does not double heavy strike', () => {
  let state = createBattle({
    script: [0, 0, 0],
    player,
    enemy: enemy({ hp: 40, maxHp: 40, attack: 3 }),
  });
  state = act(state, 'focus');
  assert.equal(state.focused, true);
  assert.equal(state.enemy.hp, 40);
  assert.equal(state.player.hp, 17);

  state = act(state, 'attack');
  assert.equal(state.enemy.hp, 32);
  assert.equal(state.focused, false);
  assert.match(state.log.join(' '), /focused strike for 8/);

  let heavy = createBattle({
    script: [0, 0, 0],
    player,
    enemy: enemy({ hp: 40, maxHp: 40, attack: 1 }),
  });
  heavy = act(heavy, 'focus');
  heavy = act(heavy, 'heavy');
  assert.equal(heavy.focused, true);
  assert.equal(heavy.enemy.hp, 32);
  assert.match(heavy.log.join(' '), /heavy strike for 8/);
});

test('a killing blow wins before the enemy can answer', () => {
  const won = act(createBattle({
    script: [0],
    player,
    enemy: enemy({ hp: 4, maxHp: 4, attack: 10 }),
  }), 'attack');
  assert.equal(won.status, 'won');
  assert.equal(won.enemy.hp, 0);
  assert.equal(won.player.hp, PLAYER.maxHp);
  assert.match(won.log.join(' '), /defeated/);
  assert.equal(act(won, 'attack'), won);
  assert.deepEqual(availableActions(won), []);
});

test('the wayfarer can lose, and a lost fight can be retried', () => {
  const lost = act(createBattle({
    script: [0],
    player: { ...player, hp: 3 },
    enemy: enemy({ hp: 30, maxHp: 30, attack: 4 }),
  }), 'focus');
  assert.equal(lost.status, 'lost');
  assert.equal(lost.player.hp, 0);
  assert.equal(lost.enemy.hp, 30);

  let run = reduceRun(reduceRun(reduceRun(createRun(3), { type: 'continue' }), { type: 'continue' }), {
    type: 'open',
    nodeId: FIGHT_ID,
  });
  for (let i = 0; i < 8 && run.battle?.status === 'ongoing'; i += 1) {
    run = reduceRun(run, { type: 'combat', action: 'focus' });
  }
  assert.equal(run.battle?.status, 'lost');
  assert.equal(run.hp, 0);
  run = reduceRun(run, { type: 'retry-fight' });
  assert.equal(run.hp, PLAYER.maxHp);
  assert.equal(run.battle?.status, 'ongoing');
  assert.equal(run.battle?.player.hp, PLAYER.maxHp);
  assert.equal(run.battle?.enemy.hp, RAT.maxHp);
  assert.equal(run.fightCleared, false);
});

test('the same seed replays the same fight and a different seed does not', () => {
  function play(seed) {
    let state = createBattle({ seed, player, enemy: enemy() });
    const seen = [];
    for (const action of ['attack', 'defend', 'focus', 'attack', 'heavy', 'attack']) {
      if (state.status !== 'ongoing') break;
      const nextAction = action === 'heavy' && !availableActions(state).includes('heavy') ? 'attack' : action;
      state = act(state, nextAction);
      seen.push({
        action: nextAction,
        playerHp: state.player.hp,
        enemyHp: state.enemy.hp,
        status: state.status,
        line: state.log.at(-1),
      });
    }
    return seen;
  }

  assert.deepEqual(play(7), play(7));
  assert.notDeepEqual(play(7), play(8));
  assert.equal(rollAt(7, 0), rollAt(7, 0));
  assert.notEqual(rollAt(7, 0), rollAt(8, 0));
  assert.equal(rollAt(7, 3), rollAt(7, 3));
});

test('the preview run has a rat, inscription, charm, and gated sentinel encounter', () => {
  assert.equal(PREVIEW_BANNER, 'Preview — progress is not saved and earns no XP');
  assert.deepEqual(NODES.map((node) => node.kind), ['fight', 'event', 'treasure', 'fight']);
  assert.deepEqual(NODES.map((node) => node.id), [FIGHT_ID, EVENT_ID, TREASURE_ID, GUARDIAN_ID]);
  assert.equal(PLAYER.maxHp, 20);
  assert.ok(RAT.maxHp < PLAYER.maxHp);
  assert.ok(RAT.attack < PLAYER.attack);
  assert.equal(INTRO.lines.length, 3);
  assert.match(INTRO.lines.join(' '), /Wayfarer/);
  assert.equal(INTRO.speaker, 'Mira');
  assert.equal(INTRO.place, 'Brackenlight');
  assert.equal(eventNode().choices.length, 3);
  assert.deepEqual(eventNode().choices.map((choice) => choice.id), ['mend', 'bargain', 'warning']);
  assert.equal(eventNode().choices[0].heal, 2);
  assert.equal(treasureNode().title, 'Ember Charm');
  assert.equal(treasureNode().attackBonus, 2);
  assert.equal(SENTINEL.maxHp, 16);
  assert.equal(SIGIL.name, 'Sentinel Sigil');
  assert.deepEqual(COMBAT.actions.map((action) => action.id), [...ACTION_IDS]);
  assert.deepEqual(HUB.locations.map((location) => location.kind), ['preview', 'locked', 'locked']);
  const joined = JSON.stringify(NODES);
  assert.doesNotMatch(joined, /Bone King/);
});

test('the floor map names only the next available preview objective', () => {
  const progress = {
    fightCleared: false,
    eventCleared: false,
    treasureCleared: false,
    guardianCleared: false,
  };
  assert.equal(nextCryptObjective(progress), 'Defeat the Crypt Rat');
  progress.fightCleared = true;
  assert.equal(nextCryptObjective(progress), 'Read the ancient inscription');
  progress.eventCleared = true;
  assert.equal(nextCryptObjective(progress), 'Take the Ember Charm');
  progress.treasureCleared = true;
  assert.equal(nextCryptObjective(progress), 'Defeat the Crypt Sentinel');
  progress.guardianCleared = true;
  assert.equal(nextCryptObjective(progress), 'Approach the sealed door');
  assert.doesNotMatch(nextCryptObjective(progress), /XP|permanent|owned/i);
});

test('event choices and the ember charm change only this run', () => {
  let run = createRun(4);
  run = reduceRun(run, { type: 'continue' });
  run = reduceRun(run, { type: 'continue' });
  assert.equal(reduceRun(run, { type: 'open', nodeId: TREASURE_ID }).phase, 'map');
  assert.equal(reduceRun(run, { type: 'open', nodeId: EVENT_ID }).phase, 'map');
  assert.equal(reduceRun(run, { type: 'open', nodeId: GUARDIAN_ID }).phase, 'map');
  run = reduceRun(run, { type: 'open', nodeId: FIGHT_ID });
  assert.equal(run.phase, 'fight');
  for (let i = 0; i < 3 && run.battle?.status !== 'won'; i += 1) {
    run = reduceRun(run, { type: 'combat', action: 'attack' });
  }
  assert.equal(run.battle?.status, 'won');
  assert.equal(run.fightCleared, true);
  const wounded = run.hp;
  assert.ok(wounded < PLAYER.maxHp);
  run = reduceRun(run, { type: 'continue' });
  run = reduceRun(run, { type: 'open', nodeId: EVENT_ID });
  run = reduceRun(run, { type: 'choose', choiceId: 'mend' });
  assert.equal(run.hp, wounded + 2);
  assert.equal(run.eventCleared, true);
  assert.match(run.outcomeNote, /recover 2 HP/);

  let hinted = createRun(5);
  hinted = reduceRun(hinted, { type: 'continue' });
  hinted = reduceRun(hinted, { type: 'continue' });
  hinted = reduceRun(hinted, { type: 'open', nodeId: FIGHT_ID });
  for (let i = 0; i < 3 && hinted.battle?.status !== 'won'; i += 1) {
    hinted = reduceRun(hinted, { type: 'combat', action: 'attack' });
  }
  const beforeHint = hinted.hp;
  hinted = reduceRun(hinted, { type: 'continue' });
  hinted = reduceRun(hinted, { type: 'open', nodeId: EVENT_ID });
  hinted = reduceRun(hinted, { type: 'choose', choiceId: 'warning' });
  assert.equal(hinted.hp, beforeHint);
  assert.match(hinted.hint, /broken compass/);
  hinted = reduceRun(hinted, { type: 'continue' });
  hinted = reduceRun(hinted, { type: 'open', nodeId: TREASURE_ID });
  assert.equal(hinted.attackBonus, 0);
  hinted = reduceRun(hinted, { type: 'continue' });
  assert.equal(hinted.phase, 'map');
  assert.equal(hinted.attackBonus, 2);
  assert.equal(nodeAccess(hinted, GUARDIAN_ID), 'ready');
  assert.equal(reduceRun(hinted, { type: 'continue' }).phase, 'map'); // door stays sealed
  hinted = reduceRun(hinted, { type: 'open', nodeId: GUARDIAN_ID });
  assert.equal(hinted.battle?.enemy.id, SENTINEL.id);
  assert.equal(hinted.battle?.player.attackBonus, 2);
  hinted = reduceRun(hinted, { type: 'combat', action: 'heavy' });
  if (hinted.battle?.status === 'ongoing') hinted = reduceRun(hinted, { type: 'combat', action: 'attack' });
  assert.equal(hinted.battle?.status, 'won');
  assert.equal(hinted.guardianCleared, true);
  assert.equal(hinted.sigilCollected, true);
  hinted = reduceRun(hinted, { type: 'continue' });
  assert.equal(hinted.phase, 'map');
  hinted = reduceRun(hinted, { type: 'continue' });
  assert.equal(hinted.phase, 'end');

  const buffed = act(createBattle({
    script: [0, 0],
    player: { ...player, attackBonus: hinted.attackBonus },
    enemy: enemy({ hp: 30, maxHp: 30, attack: 1 }),
  }), 'attack');
  assert.equal(buffed.enemy.hp, 24);

  const restarted = reduceRun(hinted, { type: 'restart', seed: 99 });
  assert.equal(restarted.phase, 'intro');
  assert.equal(restarted.seed, 99);
  assert.equal(restarted.hp, PLAYER.maxHp);
  assert.equal(restarted.attackBonus, 0);
  assert.equal(restarted.guardianCleared, false);
  assert.equal(restarted.sigilCollected, false);
  assert.equal(restarted.hint, null);
  assert.equal(nodeAccess(restarted, FIGHT_ID), 'ready');
});

test('the end card relic is data, so the name can be swapped', () => {
  assert.equal(END_CARD.artifact, 'broken compass');
  assert.equal(endCardParagraphs()[1], 'Your broken compass twitches once, then goes still.');
  assert.equal(endCardParagraphs()[2], 'To be continued.');
  assert.equal(endCardParagraphs('crown-key')[1], 'Your crown-key twitches once, then goes still.');
  assert.equal(Object.keys(SPRITES).includes('compass'), true);
});
