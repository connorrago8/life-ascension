/** Audit fixes: B4 self-redraw loop is closed; gear is explicit Wear only (never auto-equipped). */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { canPlay, playCard, startBattle } from '../lib/crypt/delve/battle.ts';
import { spawnFoe } from '../lib/crypt/delve/floor.ts';
import { lootById } from '../lib/crypt/delve/loot.ts';
import { seedRng } from '../lib/crypt/delve/rng.ts';
import { canWearDrop, createDelve, reduceDelve, wearPreview } from '../lib/crypt/delve/run.ts';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const ZERO = { strength: 0, agility: 0, intelligence: 0, endurance: 0, luck: 0 };
const runId = '00000000-0000-4000-a000-0000000000f4';

function battleWith(deck) {
  return startBattle({ rng: seedRng(7), deck, attributes: ZERO, hp: 50, maxHp: 50, foe: spawnFoe('crypt-rat', 0) });
}

function total(b) { return b.drawPile.length + b.hand.length + b.discard.length + b.exhausted.length; }

/** Play every playable 0-cost card with a draw effect until none is left; returns plays made. */
function spamFreeDrawers(battle, limit = 200) {
  let plays = 0;
  for (; plays < limit; plays += 1) {
    const card = battle.hand.find((c) => (c.id === 'haste' || c.id === 'insight' || c.id === 'adrenaline') && canPlay(battle, c.uid));
    if (!card) break;
    battle = playCard(battle, card.uid);
  }
  return { battle, plays };
}

test('B4: Haste in a 5-card deck cannot reshuffle and redraw itself', () => {
  const start = battleWith(['haste', 'strike', 'strike', 'strike', 'strike']);
  assert.equal(start.hand.length, 5, 'whole deck in hand, empty draw and discard');
  const { battle, plays } = spamFreeDrawers(start);
  assert.equal(plays, 1, 'Haste is played once, not 50 times');
  assert.equal(battle.haste, 1);
  assert.equal(battle.played, 1);
  assert.ok(battle.discard.some((c) => c.id === 'haste'), 'Haste still goes to the discard after its draw');
  assert.equal(total(battle), 5, 'no card lost or duplicated');
});

test('B4: Insight in a 6-card deck draws the other cards, never itself', () => {
  const start = battleWith(['insight', 'guard', 'guard', 'guard', 'guard', 'guard']);
  const cards = [...start.hand, ...start.drawPile];
  const insight = cards.find((c) => c.id === 'insight');
  const guards = cards.filter((c) => c.id !== 'insight');
  // Insight in hand, one Guard left to draw, empty discard: the old order redrew Insight here.
  const crafted = { ...start, hand: [insight, ...guards.slice(0, 4)], drawPile: [guards[4]], discard: [] };
  const { battle, plays } = spamFreeDrawers(crafted);
  assert.equal(plays, 1, `Insight played ${plays} times`);
  assert.equal(battle.played, 1);
  assert.equal(battle.hand.length, 5, 'drew the last Guard only');
  assert.ok(!battle.hand.some((c) => c.id === 'insight'), 'Insight is not back in hand');
  assert.deepEqual(battle.discard.map((c) => c.id), ['insight']);
  assert.equal(total(battle), 6);
});

test('B4: a drawer still reshuffles the rest of the discard ("Draw 1" unchanged)', () => {
  const start = battleWith(['haste', 'strike', 'strike', 'strike', 'strike', 'guard', 'guard']);
  const haste = { uid: 0, id: 'haste' };
  const crafted = {
    ...start, energy: 3,
    hand: [haste], drawPile: [],
    discard: [1, 2, 3, 4, 5, 6].map((uid) => ({ uid, id: uid < 5 ? 'strike' : 'guard' })),
  };
  const after = playCard(crafted, 0);
  assert.equal(after.hand.length, 1, 'drew exactly 1');
  assert.notEqual(after.hand[0].id, 'haste');
  assert.deepEqual(after.discard.map((c) => c.id), ['haste'], 'only Haste in discard; the rest became the draw pile');
  assert.equal(after.drawPile.length, 5);
  assert.equal(total(after), 7);
});

function walk(seed, onState) {
  let state = createDelve({ runId, seed, level: 5, allocated: { strength: 4, agility: 4, intelligence: 3, endurance: 3, luck: 3 } });
  for (let guard = 0; guard < 4000; guard += 1) {
    onState(state);
    if (state.phase === 'defeat' || state.phase === 'floor-clear') return state;
    let command;
    if (state.phase === 'start-pick') command = { type: 'pick-start', cardId: state.startPick[0] };
    else if (state.phase === 'map') command = { type: 'choose-room', row: state.row, index: 0 };
    else if (state.phase === 'combat') {
      const playable = state.battle.hand.find((c) => canPlay(state.battle, c.uid));
      command = playable ? { type: 'play', uid: playable.uid } : { type: 'end-turn' };
    } else if (state.phase === 'reward') command = { type: 'pick-card', cardId: null };
    else if (state.phase === 'event') command = state.event.outcome ? { type: 'continue' } : { type: 'event-option', optionId: 'leave' };
    else if (state.phase === 'rest') command = { type: 'rest', choice: 'heal' };
    else command = { type: 'continue' };
    let next = reduceDelve(state, command);
    for (const optionId of ['pray', 'answer', 'run']) if (next === state && state.phase === 'event') next = reduceDelve(state, { type: 'event-option', optionId });
    assert.notEqual(next, state, `stuck in ${state.phase}`);
    state = next;
  }
  throw new Error('run did not finish');
}

test('gear from fights, elites, chests, events and the boss is never equipped automatically', () => {
  let drops = 0;
  for (let seed = 1; seed <= 25; seed += 1) {
    const end = walk(seed, (state) => {
      assert.deepEqual(state.loadout, {}, `seed ${seed}: nothing worn without a Wear tap (${state.phase})`);
      if (state.reward) assert.equal(state.reward.worn, false);
      assert.equal('equipped' in (state.reward ?? {}), false);
    });
    drops += end.found.length;
  }
  assert.ok(drops > 20, `loot still drops and is kept (${drops})`);
});

test('Wear is explicit: only the drop on screen, once, and it refreshes max HP', () => {
  let found = null;
  walk(3, (state) => {
    if (!found && state.reward?.loot && (state.phase === 'reward' || state.phase === 'treasure' || (state.phase === 'event' && state.event?.outcome))) found = state;
  });
  assert.ok(found, 'a wearable drop was reached');
  const id = found.reward.loot;
  const entry = lootById(id);
  assert.ok(canWearDrop(found, id));
  assert.deepEqual(wearPreview(found.loadout, id), { replaces: null, better: true });
  const worn = reduceDelve(found, { type: 'wear', itemId: id });
  assert.equal(worn.loadout[entry.slot], id);
  assert.equal(worn.reward.worn, true);
  assert.deepEqual(worn.found, found.found, 'loot list unchanged');
  assert.ok(worn.maxHp >= found.maxHp);
  assert.equal(reduceDelve(worn, { type: 'wear', itemId: id }), worn, 'second tap is a no-op');
  assert.equal(reduceDelve(found, { type: 'wear', itemId: 'not-a-drop' }), found, 'unknown item rejected');
  const other = ['ember-blade', 'hollow-crown', 'grave-mail'].find((x) => x !== id);
  assert.equal(reduceDelve(found, { type: 'wear', itemId: other }), found, 'only the gear that just dropped');
  assert.equal(reduceDelve({ ...found, phase: 'map' }, { type: 'wear', itemId: id }).loadout[entry.slot], undefined, 'not from the map');
  assert.equal(reduceDelve({ ...found, phase: 'floor-clear' }, { type: 'wear', itemId: id }).loadout[entry.slot], undefined, 'boss gear waits for camp');
});

test('UI and sim follow explicit Wear: no "Equipped" messaging, a Wear button, sim taps Wear', () => {
  const ui = read('components/crypt/DelveRun.tsx');
  assert.doesNotMatch(ui, /Equipped —|look at your adventurer|Sent to your vault/);
  assert.match(ui, /Added to vault · tap Wear at camp\./);
  assert.match(ui, /Added to vault · tap Wear to use it this run, or Wear it at camp\./);
  assert.match(ui, /send\(\{ type: 'wear', itemId \}\)/);
  assert.match(ui, /className="btn ghost delve-wear-now"/);
  const css = read('app/style.css');
  assert.match(css, /\.delve-wear-now \{[^}]*min-height: 44px/);
  const run = read('lib/crypt/delve/run.ts');
  assert.doesNotMatch(run.slice(run.indexOf('function dropLoot'), run.indexOf('const WEAR_PHASES')), /loadout/);
  const sim = read('scripts/simulate-crypt-delve.mjs');
  assert.match(sim, /type: 'wear'/);
});
