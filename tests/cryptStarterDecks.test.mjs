/** Starter decks: four tuned lists of existing cards, chosen at run start; no choice = default deck. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { CARDS, MAX_DECK_SIZE, STARTER_DECK } from '../lib/crypt/delve/cards.ts';
import { MIN_DECK_SIZE, createDelve, currentRoomChoices, reduceDelve } from '../lib/crypt/delve/run.ts';
import { STARTER_DECKS, STARTER_IDS, starterById, starterCards, starterSummary } from '../lib/crypt/delve/starters.ts';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const ZERO = { strength: 0, agility: 0, intelligence: 0, endurance: 0, luck: 0 };
const runId = '00000000-0000-4000-a000-0000000000d5';
const sorted = (cards) => [...cards].sort();

const EXPECTED = {
  bruiser: ['strike', 'strike', 'rend', 'guard', 'guard', 'guard', 'bash', 'battle-cry', 'focus', 'cleaver'],
  duelist: ['strike', 'strike', 'strike', 'guard', 'guard', 'guard', 'guard', 'quick-jab', 'momentum', 'riposte'],
  scholar: ['spark', 'strike', 'strike', 'guard', 'guard', 'guard', 'guard', 'arcane-bolt', 'hex', 'kindle'],
  guardian: ['strike', 'strike', 'strike', 'guard', 'guard', 'iron-skin', 'iron-skin', 'body-slam', 'shield-bash', 'entrench'],
};

test('four starter decks with the tuned compositions', () => {
  assert.deepEqual([...STARTER_IDS], ['bruiser', 'duelist', 'scholar', 'guardian']);
  for (const deck of STARTER_DECKS) {
    assert.deepEqual(sorted(deck.cards), sorted(EXPECTED[deck.id]), deck.id);
    assert.ok(deck.name.length > 0 && deck.line.length > 10, `${deck.id} has a name and a one-line playstyle`);
  }
  assert.deepEqual(starterSummary(EXPECTED.duelist).find((e) => e.id === 'guard'), { id: 'guard', name: 'Guard', count: 4 });
});

test('starter decks are legal: existing cards only, base versions, within the deck minimum and cap', () => {
  for (const deck of STARTER_DECKS) {
    assert.equal(deck.cards.length, 10, deck.id);
    for (const id of deck.cards) {
      assert.ok(CARDS[id], `${deck.id}: ${id} is an existing card`);
      assert.ok(!String(id).endsWith('+'), `${deck.id}: no upgraded cards`);
    }
    assert.ok(deck.cards.length > MIN_DECK_SIZE, 'campfire removal stays possible');
    assert.ok(deck.cards.length + 1 <= MAX_DECK_SIZE, 'room for the opening pick');
    const defense = deck.cards.filter((id) => (CARDS[id].block ?? 0) > 0).length;
    assert.ok(defense >= 3, `${deck.id} has at least 3 Block cards (${defense})`);
  }
});

test('deck select comes first, then the mandatory 1-of-2 opening pick', () => {
  for (const deck of STARTER_DECKS) {
    const run = createDelve({ runId, seed: 41, level: 3, allocated: ZERO, deckSelect: true });
    assert.equal(run.phase, 'deck-select');
    assert.equal(run.starter, null);
    assert.equal(reduceDelve(run, { type: 'pick-start', cardId: run.startPick[0] }), run, 'no opening pick before the deck');
    assert.equal(reduceDelve(run, { type: 'choose-room', row: 0, index: 0 }), run, 'no rooms before the deck');
    assert.equal(reduceDelve(run, { type: 'pick-deck', deckId: 'wizard' }), run, 'unknown deck rejected');
    const chosen = reduceDelve(run, { type: 'pick-deck', deckId: deck.id });
    assert.equal(chosen.phase, 'start-pick');
    assert.equal(chosen.starter, deck.id);
    assert.deepEqual(chosen.deck, [...deck.cards]);
    assert.equal(reduceDelve(chosen, { type: 'pick-deck', deckId: 'guardian' }), chosen, 'chosen once');
    assert.equal(reduceDelve(chosen, { type: 'choose-room', row: 0, index: 0 }), chosen, 'opening pick still mandatory');
    const picked = reduceDelve(chosen, { type: 'pick-start', cardId: chosen.startPick[1] });
    assert.equal(picked.phase, 'map');
    assert.equal(picked.deck.length, 11);
    // The choice only swaps the deck: floor layout, opening offer and seed streams are unchanged.
    assert.deepEqual(chosen.rows, run.rows);
    assert.deepEqual(chosen.startPick, run.startPick);
    assert.deepEqual(chosen.rng, run.rng);
  }
});

test('fallback: no choice (or an old run without the field) uses the default starting deck', () => {
  assert.deepEqual(starterCards(null), [...STARTER_DECK]);
  assert.deepEqual(starterCards(undefined), [...STARTER_DECK]);
  assert.deepEqual(starterCards('not-a-deck'), [...STARTER_DECK]);
  assert.equal(starterById('nope'), null);
  const plain = createDelve({ runId, seed: 9, level: 1, allocated: ZERO });
  assert.equal(plain.phase, 'start-pick');
  assert.deepEqual(plain.deck, [...STARTER_DECK]);
  const old = { ...plain };
  delete old.starter;
  const resumed = reduceDelve(old, { type: 'pick-start', cardId: old.startPick[0] });
  assert.equal(resumed.phase, 'map');
  assert.deepEqual(resumed.deck.slice(0, 10), [...STARTER_DECK]);
  assert.equal(reduceDelve(old, { type: 'pick-deck', deckId: 'bruiser' }), old, 'no deck swap mid-run');
  const fight = reduceDelve(resumed, { type: 'choose-room', row: 0, index: 0 });
  assert.equal(currentRoomChoices(resumed).length > 0, true);
  assert.notEqual(fight, resumed);
});

test('UI: camp starts runs on deck select (guest preview too), with 44px choose/view buttons', () => {
  const ui = read('components/crypt/DelveRun.tsx');
  assert.match(ui, /createDelve\(\{[^}]*deckSelect: true \}\)/);
  assert.match(ui, /state\.phase === 'deck-select' \? <DeckSelectView send=\{send\} \/>/);
  assert.match(ui, /send\(\{ type: 'pick-deck', deckId: deck\.id \}\)/);
  assert.match(ui, />View cards</);
  const css = read('app/style.css');
  assert.match(css, /\.delve-starter-pick \{[^}]*min-height: 44px/);
  assert.match(css, /\.delve-starter-view \{[^}]*min-height: 44px/);
  const run = read('lib/crypt/delve/run.ts');
  assert.doesNotMatch(run, /localStorage|sessionStorage|supabase|\.rpc\(/, 'choice lives in run state only');
});
