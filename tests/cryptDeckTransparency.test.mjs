import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { startBattle, playCard, endTurn, previewDamage, previewHits, cardCues, hitParts } from '../lib/crypt/delve/battle.ts';
import { cardDef, comboBonus, MAX_DECK_SIZE, STARTER_DECK } from '../lib/crypt/delve/cards.ts';
import { pileSummary, copiesInDeck, deckIsFull } from '../lib/crypt/delve/piles.ts';
import { createDelve, reduceDelve } from '../lib/crypt/delve/run.ts';
import { seedRng } from '../lib/crypt/delve/rng.ts';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
// LCK 0 = 0% crit, so every hit is deterministic and the preview must match exactly.
const LV1 = { strength: 2, agility: 2, intelligence: 2, endurance: 2, luck: 0 };
const MID = { strength: 4, agility: 4, intelligence: 3, endurance: 3, luck: 0 };
const INT = { strength: 0, agility: 0, intelligence: 17, endurance: 0, luck: 0 };
const dummy = { id: 'dummy', name: 'Dummy', type: 'rot', sprite: 'rat', rank: 'normal', hp: 999, maxHp: 999, intents: [{ kind: 'attack', value: 5 }] };

/** Every card in hand, plenty of energy, played in the given order. */
function fight(cards, attributes) {
  let battle = startBattle({ rng: seedRng(7), deck: cards, attributes, hp: 60, maxHp: 60, foe: { ...dummy } });
  return { ...battle, hand: [...battle.hand, ...battle.drawPile].sort((a, b) => a.uid - b.uid), drawPile: [], energy: 10 };
}

/** Plays cards in order; for each damaging card asserts shown damage == dealt and returns what the cues said. */
function playAll(cards, attributes) {
  let battle = fight(cards, attributes);
  const seen = [];
  for (const card of [...battle.hand]) {
    const shown = previewDamage(battle, card.id);
    const hits = previewHits(battle, card.id);
    const cues = cardCues(battle, card.id).map((cue) => cue.label);
    const parts = hitParts(cardDef(card.id), battle);
    battle = playCard(battle, card.uid);
    assert.equal(battle.feedback.crit, false);
    if (shown !== null) assert.equal(battle.feedback.dealt, shown * hits, `${card.id}: shown ${shown}×${hits} vs dealt ${battle.feedback.dealt}`);
    seen.push({ id: card.id, shown, hits, cues, parts, dealt: battle.feedback.dealt });
  }
  return { battle, seen };
}

test('Battle Cry + Heavy Blow: Might cue and shown damage equal the hit (Lv1 and mid build)', () => {
  for (const [attributes, before, after] of [[LV1, 16, 18], [MID, 18, 20]]) {
    assert.equal(previewDamage(fight(['heavy-blow'], attributes), 'heavy-blow'), before);
    const { seen } = playAll(['battle-cry', 'heavy-blow'], attributes);
    assert.equal(seen[1].shown, after);
    assert.equal(seen[1].dealt, after);
    assert.ok(seen[1].cues.includes('Might +2'));
    assert.equal(seen[1].parts.might, 2);
  }
});

test('Adrenaline + Quick Jab + Momentum: Momentum and combo cues add up to the hit', () => {
  for (const [attributes, total] of [[LV1, 13], [MID, 16]]) {
    const { seen } = playAll(['adrenaline', 'quick-jab', 'momentum'], attributes);
    const momentum = seen[2];
    assert.equal(momentum.dealt, total);
    assert.ok(momentum.cues.includes('Momentum +6'), momentum.cues.join());
    assert.ok(momentum.cues.includes(`Combo +${comboBonus(attributes)}`), momentum.cues.join());
    const p = momentum.parts;
    assert.equal(p.card + p.momentum + p.might + p.combo, total, 'parts sum to the per-hit damage');
  }
});

test('Hex + Arcane Bolt: Exposed cue, Weakened shown on the foe, damage ×1.5 as shown', () => {
  for (const [attributes, before, after] of [[LV1, 8, 12], [INT, 17, 26]]) {
    assert.equal(previewDamage(fight(['arcane-bolt'], attributes), 'arcane-bolt'), before);
    const { seen, battle } = playAll(['hex', 'arcane-bolt'], attributes);
    assert.equal(seen[1].dealt, after);
    assert.ok(seen[1].cues.includes('Exposed ×1.5'));
    assert.ok(battle.foe.weak > 0);
  }
});

test('Iron Skin + Body Slam: "= Block N" cue matches Block and the hit; 0 Block warns and flags wasted Focus', () => {
  for (const attributes of [LV1, MID]) {
    const battle = playCard(fight(['iron-skin', 'body-slam'], attributes), 0);
    const cues = cardCues(battle, 'body-slam').map((cue) => cue.label);
    assert.ok(cues.includes(`= Block ${battle.block}`), cues.join());
    const { seen } = playAll(['iron-skin', 'body-slam'], attributes);
    assert.equal(seen[1].dealt, battle.block);
  }
  const zero = fight(['body-slam'], LV1);
  assert.equal(previewDamage(zero, 'body-slam'), null);
  assert.deepEqual(cardCues(zero, 'body-slam').map((cue) => cue.label), ['No Block: 0']);
  const focused = playCard(fight(['focus', 'body-slam'], LV1), 0);
  assert.ok(cardCues(focused, 'body-slam').some((cue) => cue.label === 'Wastes Focus' && cue.warn));
});

test('Focus + Flurry and Battle Cry + Focus + Flurry: Focus cue, shown × hits = dealt', () => {
  const a = playAll(['focus', 'flurry'], LV1).seen[1];
  assert.equal(a.shown * a.hits, a.dealt);
  assert.ok(a.cues.includes('Focus ×2'));
  const b = playAll(['battle-cry', 'focus', 'flurry'], LV1).seen[2];
  assert.equal(b.dealt, 42);
  for (const cue of ['Might +2', 'Focus ×2', `Combo +${comboBonus(LV1)}`]) assert.ok(b.cues.includes(cue), cue);
});

test('cues never claim a bonus for a card that deals nothing, and the combo cue on Block cards matches the Block gained', () => {
  let battle = fight(['strike', 'strike', 'guard'], LV1);
  battle = playCard(playCard(battle, 0), 1);
  const cue = cardCues(battle, 'guard').find((entry) => entry.key === 'combo');
  assert.equal(cue?.label, `Combo +${comboBonus(LV1)} Block`);
  const plain = playCard(fight(['guard'], LV1), 0).block;
  const before = battle.block;
  const after = playCard(battle, 2);
  assert.equal(after.block - before, plain + comboBonus(LV1), 'combo Block cue matches the Block gained');
  assert.deepEqual(cardCues(fight(['guard'], LV1), 'guard'), []);
});

test('pile lists are grouped and sorted by cost then name, never in draw order', () => {
  const deck = ['strike', 'guard', 'bash', 'focus', 'strike+', 'guard', 'spark'];
  const a = pileSummary(deck);
  const b = pileSummary([...deck].reverse());
  assert.deepEqual(a, b, 'input order does not change the list');
  assert.deepEqual(a.map((e) => `${e.cost}:${e.name}×${e.count}`), ['0:Focus×1', '1:Guard×2', '1:Spark×1', '1:Strike×1', '1:Strike+×1', '2:Bash×1']);
  assert.equal(a.reduce((sum, e) => sum + e.count, 0), deck.length);
  assert.ok(a.find((e) => e.key === 'strike+').upgraded);
  // In a real fight, the sheet for the draw pile matches the pile's contents, not its order.
  let battle = startBattle({ rng: seedRng(3), deck: STARTER_DECK.slice(), attributes: LV1, hp: 60, maxHp: 60, foe: { ...dummy } });
  for (let turn = 0; turn < 4; turn += 1) {
    const listed = pileSummary(battle.drawPile);
    assert.equal(listed.reduce((sum, e) => sum + e.count, 0), battle.drawPile.length);
    assert.deepEqual(listed, pileSummary([...battle.drawPile].reverse()));
    battle = endTurn(battle);
  }
});

test('reward: copies count, deck-full detection, and an honest note at the 26-card cap', () => {
  assert.equal(copiesInDeck(['strike', 'strike+', 'guard'], 'strike'), 2);
  let state = createDelve({ runId: 'r', seed: 5, level: 1, allocated: LV1 });
  state = reduceDelve(state, { type: 'pick-start', cardId: state.startPick[0] });
  const reward = { cards: ['strike', 'guard', 'spark'], picked: false, loot: null, equipped: false };
  const below = reduceDelve({ ...state, phase: 'reward', reward }, { type: 'pick-card', cardId: 'spark' });
  assert.equal(below.deck.length, state.deck.length + 1);
  assert.match(below.note, /Spark added to your deck/);
  const fullDeck = Array.from({ length: MAX_DECK_SIZE }, () => 'strike');
  assert.ok(deckIsFull(fullDeck));
  const full = reduceDelve({ ...state, deck: fullDeck, phase: 'reward', reward }, { type: 'pick-card', cardId: 'spark' });
  assert.equal(full.deck.length, MAX_DECK_SIZE, 'cap unchanged');
  assert.doesNotMatch(full.note, /added to your deck/);
  assert.match(full.note, /full \(26 cards\)/);
});

test('UI: pile buttons with 44px targets, sheet above the bottom nav, reward deck info, display-only cues', () => {
  const ui = read('components/crypt/DelveRun.tsx');
  const css = read('app/style.css');
  assert.match(ui, /function PileButtons/);
  assert.match(ui, /\['exhaust', 'Exhaust', battle\.exhausted\.length\]/);
  assert.match(ui, /Not the order you will draw/);
  assert.doesNotMatch(ui, /drawPile\.map\(/, 'draw pile is only listed through pileSummary');
  assert.match(ui, /cardCues\(battle, id\)/);
  assert.match(ui, /You have \{have\}/);
  assert.match(ui, /View deck/);
  assert.match(ui, /Deck <strong>\{state\.deck\.length\}\/\{MAX_DECK_SIZE\}<\/strong>/);
  assert.match(css, /\.delve-pile-btn \{[^}]*min-height: 44px/);
  assert.match(css, /\.delve-pile-sheet \{ bottom: calc\(78px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(css, /\.delve-pile-close \{ min-height: 44px/);
});
