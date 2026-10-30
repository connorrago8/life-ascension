import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { startBattle, playCard, endTurn, wornDownDamage, WORN_DOWN_TURN, WORN_DOWN_PER_END } from '../lib/crypt/delve/battle.ts';
import { REWARD_POOL, STARTER_DECK } from '../lib/crypt/delve/cards.ts';
import { spawnFoe } from '../lib/crypt/delve/floor.ts';
import { createDelve, reduceDelve, currentRoomChoices } from '../lib/crypt/delve/run.ts';
import { seedRng } from '../lib/crypt/delve/rng.ts';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const ZERO = { strength: 0, agility: 0, intelligence: 0, endurance: 0, luck: 0 };
const dummy = (intents, hp = 300) => ({ ...spawnFoe('crypt-rat', 0), intents, hp, maxHp: hp });
const fight = (deck, intents, extra = {}) =>
  startBattle({ rng: seedRng(11), deck, attributes: extra.attributes ?? ZERO, hp: 80, maxHp: 80, foe: dummy(intents), passives: extra.passives });
const play = (battle, id) => playCard(battle, battle.hand.find((c) => c.id === id).uid);
const kinds = (battle) => battle.feedback.procs.map((proc) => proc.kind);

/* ---------- Opening variety ---------- */

test('each run opens with a pick of 1 of 2 different cards from the reward pool', () => {
  const seen = new Set();
  for (let seed = 1; seed <= 30; seed += 1) {
    const run = createDelve({ runId: 'r', seed, level: 3, allocated: ZERO });
    assert.equal(run.phase, 'start-pick');
    assert.equal(run.startPick.length, 2);
    assert.notEqual(run.startPick[0], run.startPick[1]);
    for (const id of run.startPick) { assert.ok(REWARD_POOL.includes(id), id); seen.add(id); }
    assert.equal(reduceDelve(run, { type: 'choose-room', row: 0, index: 0 }), run, 'no rooms before the pick');
    assert.equal(reduceDelve(run, { type: 'pick-start', cardId: 'strike' }), run, 'only an offered card');
    const picked = reduceDelve(run, { type: 'pick-start', cardId: run.startPick[1] });
    assert.equal(picked.phase, 'map');
    assert.deepEqual(picked.deck, [...STARTER_DECK, run.startPick[1]]);
    assert.deepEqual(picked.startPick, []);
    assert.equal(reduceDelve(picked, { type: 'pick-start', cardId: run.startPick[0] }), picked, 'only once');
  }
  assert.ok(seen.size >= 8, 'the offer varies between runs');
  const a = createDelve({ runId: 'r', seed: 42, level: 3, allocated: ZERO });
  const b = createDelve({ runId: 'r', seed: 42, level: 3, allocated: ZERO });
  assert.deepEqual(a.startPick, b.startPick, 'seeded');
  const picked = reduceDelve(a, { type: 'pick-start', cardId: a.startPick[0] });
  assert.deepEqual(currentRoomChoices(picked), currentRoomChoices(reduceDelve(b, { type: 'pick-start', cardId: b.startPick[1] })), 'the pick does not change the map');
});

/* ---------- END tune: long-fight damage floor ---------- */

test('long-fight damage floor: END keeps the foe worn down from turn 2 when your cards deal too little', () => {
  assert.equal(WORN_DOWN_TURN, 2);
  assert.equal(wornDownDamage(1, 17, 0), 0, 'never on turn 1');
  assert.equal(wornDownDamage(2, 17, 0), Math.floor(17 * WORN_DOWN_PER_END));
  assert.equal(wornDownDamage(3, 17, 10), Math.floor(17 * WORN_DOWN_PER_END) - 10, 'only the shortfall');
  assert.equal(wornDownDamage(3, 17, 100), 0, 'hard hitters never see it');
  assert.equal(wornDownDamage(5, 0, 0), 0, 'no END, no floor');

  const attributes = { ...ZERO, endurance: 10 };
  let battle = fight(['guard', 'guard', 'guard', 'guard', 'guard'], [{ kind: 'guard', value: 0 }], { attributes });
  let hp = battle.foe.hp;
  battle = endTurn(battle);
  assert.equal(battle.foe.hp, hp, 'turn 1: nothing');
  hp = battle.foe.hp;
  battle = endTurn(battle);
  assert.equal(hp - battle.foe.hp, 17, 'turn 2: worn down by END × 1.75');
  assert.ok(kinds(battle).includes('worn'));
  assert.ok(battle.log.some((line) => /Worn down 17/.test(line)));
});

/* ---------- Status and gear feedback ---------- */

test('Bleed, Burn, Thorns and the AGI combo report a floating number when they trigger', () => {
  let battle = fight(['rend', 'kindle', 'guard', 'guard', 'guard'], [{ kind: 'guard', value: 0 }]);
  battle = endTurn(play(play(battle, 'rend'), 'kindle'));
  const procs = battle.feedback.procs;
  assert.deepEqual(procs.find((p) => p.kind === 'burn'), { kind: 'burn', amount: 4, text: 'Burn −4' });
  assert.deepEqual(procs.find((p) => p.kind === 'bleed'), { kind: 'bleed', amount: 3, text: 'Bleed −3' });

  let thorns = fight(['spiked-guard', 'guard', 'guard', 'guard', 'guard'], [{ kind: 'attack', value: 3, hits: 2 }]);
  thorns = endTurn(play(thorns, 'spiked-guard'));
  assert.equal(thorns.feedback.procs.find((p) => p.kind === 'thorns').amount, 4);

  let combo = fight(['haste', 'strike', 'strike', 'strike', 'guard'], [{ kind: 'guard', value: 0 }]);
  combo = play(play(combo, 'haste'), 'strike');
  assert.ok(!kinds(combo).includes('combo'));
  combo = play(combo, 'strike');
  assert.ok(kinds(combo).includes('combo'), 'the 3rd card shows the combo');
  const seq = combo.feedback.seq;
  combo = endTurn(combo);
  assert.ok(combo.feedback.seq > seq, 'each step has a new seq so the UI replays the effect');
});

test('rare/epic gear passives report a toast when they trigger', () => {
  const deck = ['strike', 'strike', 'kindle', 'guard', 'guard'];
  const guardOnly = [{ kind: 'guard', value: 0 }];
  const text = (battle) => battle.feedback.procs.filter((p) => p.kind === 'gear').map((p) => p.text).join(' | ');
  assert.match(text(fight(deck, guardOnly, { passives: ['start-block'] })), /start with 4 Block/);
  assert.match(text(fight(deck, guardOnly, { passives: ['start-thorns'] })), /Thorns 3/);
  assert.equal(text(fight(deck, guardOnly)), '', 'no gear, no toast');

  let twin = play(fight(deck, guardOnly, { passives: ['twin-strike'] }), 'strike');
  assert.match(text(twin), /twin strike/);
  twin = play(twin, 'strike');
  assert.equal(text(twin), '', 'only when it fires');

  const burn = endTurn(play(fight(deck, guardOnly, { passives: ['burn-plus'] }), 'kindle'));
  assert.match(text(burn), /Burn \+1/);

  let dodge = fight(deck, [{ kind: 'attack', value: 5 }], { passives: ['first-dodge'] });
  dodge = endTurn(dodge);
  assert.match(text(dodge), /dodged/);
  assert.equal(dodge.gearDodge, false);
});

/* ---------- UI ---------- */

test('combat UI: start pick, big-hit urgency, proc floaters and gear toasts (CSS-only, reduced-motion safe)', () => {
  const ui = read('components/crypt/DelveRun.tsx');
  const css = read('app/style.css');
  assert.match(ui, /function StartPickView/);
  assert.match(ui, /type: 'pick-start'/);
  assert.match(ui, /delve-bighit/);
  assert.match(ui, /function ProcFloaters/);
  assert.match(ui, /role="status"/);
  assert.match(ui, /key=\{`proc-\$\{battle\.feedback\.seq\}/);
  assert.doesNotMatch(ui, /setTimeout|setInterval|localStorage/);
  assert.match(css, /prefers-reduced-motion: no-preference[\s\S]*delve-bighit/);
  assert.match(css, /\.delve-card[^{]*\{[^}]*min-height: (4[4-9]|[5-9]\d|1\d\d)px/);
});
