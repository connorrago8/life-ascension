import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  startBattle, playCard, endTurn, foeIntent, upcomingIntent, incomingDamage, intentText, bigHitComing, previewDamage,
  previewHits, cardCritChance, comboReady, PASSIVE_TEXT,
} from '../lib/crypt/delve/battle.ts';
import { CARDS, COMBO_AT, cardDef, comboBonus, upgradeDef, cardBleed, cardThorns } from '../lib/crypt/delve/cards.ts';
import { spawnFoe, FOES, BOSS, EVENTS } from '../lib/crypt/delve/floor.ts';
import { LOOT, lootById, gearTooltip, passiveLabel, bonusLabel, loadoutPassives, loadoutCards } from '../lib/crypt/delve/loot.ts';
import { createDelve as openDelve, reduceDelve, canUpgradeCard, MIN_DECK_SIZE } from '../lib/crypt/delve/run.ts';
// Runs open with a 1-of-2 starting card pick; most tests take the first offer and go to the map.
const createDelve = (input) => { const s = openDelve(input); return reduceDelve(s, { type: 'pick-start', cardId: s.startPick[0] }); };
import { seedRng } from '../lib/crypt/delve/rng.ts';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const ZERO = { strength: 0, agility: 0, intelligence: 0, endurance: 0, luck: 0 };
const dummy = (intents, hp = 200) => ({ ...spawnFoe('crypt-rat', 0), intents, hp, maxHp: hp });
const fight = (deck, intents, extra = {}) =>
  startBattle({ rng: seedRng(11), deck, attributes: extra.attributes ?? ZERO, hp: 80, maxHp: 80, foe: dummy(intents), passives: extra.passives });
const play = (battle, id) => playCard(battle, battle.hand.find((c) => c.id === id).uid);

/* ---------- Intents ---------- */

test('incoming damage shown is exactly what you take (after Rage, Weaken and Block)', () => {
  let battle = fight(['guard', 'strike', 'strike', 'strike', 'strike'], [{ kind: 'attack', value: 9, hits: 2 }]);
  battle.foe.strength = 2;
  const shown = incomingDamage(battle);
  assert.deepEqual(shown, { perHit: 11, hits: 2, total: 22, afterBlock: 22 });
  battle = play(battle, 'guard');
  assert.equal(incomingDamage(battle).afterBlock, 22 - 5);
  const after = endTurn(battle);
  assert.equal(battle.hp - after.hp, incomingDamage(battle).afterBlock, 'no random extra damage');
  assert.match(intentText(battle), /11×2/);
});

test('foes loop short 2–4 step patterns, and a wind-up telegraphs the big hit next turn', () => {
  let telegraphs = 0;
  for (const foe of [...FOES, BOSS]) {
    assert.ok(foe.intents.length >= 2 && foe.intents.length <= 5, `${foe.id} pattern length`);
    foe.intents.forEach((intent, i) => {
      if (intent.kind !== 'charge') return;
      telegraphs += 1;
      const next = foe.intents[(i + 1) % foe.intents.length];
      assert.equal(next.kind, 'attack', `${foe.id}: a wind-up is followed by an attack`);
      const others = foe.intents.filter((entry) => entry.kind === 'attack' && entry !== next).map((entry) => entry.value * (entry.hits ?? 1));
      assert.ok(others.every((value) => next.value > value), `${foe.id}: the telegraphed hit is the biggest`);
    });
  }
  assert.ok(telegraphs >= 5, 'several foes telegraph a big hit');
  let battle = startBattle({ rng: seedRng(2), deck: ['strike', 'strike', 'strike', 'strike', 'guard'], attributes: ZERO, hp: 80, maxHp: 80, foe: spawnFoe('restless-skeleton', 0) });
  assert.equal(foeIntent(battle).kind, 'attack');
  assert.equal(bigHitComing(battle), false);
  battle = endTurn(battle);
  assert.equal(foeIntent(battle).kind, 'charge');
  assert.equal(bigHitComing(battle), true);
  assert.equal(upcomingIntent(battle).label, 'Bone crush');
  assert.match(intentText(battle), /Winding up/);
  battle = endTurn(battle);
  assert.ok(battle.log.some((line) => /Bone crush is coming/.test(line)));
  assert.ok(incomingDamage(battle).total >= 14);
});

test('hex weakens your attacks by 25% for your next turn only', () => {
  let battle = fight(['strike', 'strike', 'strike', 'strike', 'strike'], [{ kind: 'hex', value: 1 }, { kind: 'guard', value: 0 }]);
  const normal = previewDamage(battle, 'strike');
  battle = endTurn(battle);
  assert.equal(battle.weak, 1);
  assert.equal(previewDamage(battle, 'strike'), Math.floor(normal * 0.75));
  battle = endTurn(battle);
  assert.equal(battle.weak, 0);
  assert.equal(previewDamage(battle, 'strike'), normal);
});

/* ---------- Stat-tied statuses ---------- */

test('Bleed (STR) ticks every turn and lasts; Burn (INT) ticks then fades', () => {
  assert.ok(cardBleed(CARDS.rend, { ...ZERO, strength: 10 }) > cardBleed(CARDS.rend, ZERO));
  let battle = fight(['rend', 'kindle', 'guard', 'guard', 'guard'], [{ kind: 'guard', value: 0 }]);
  battle = play(play(battle, 'rend'), 'kindle');
  assert.equal(battle.foe.bleed, 3);
  assert.equal(battle.foe.burn, 4);
  const hp = battle.foe.hp;
  battle = endTurn(battle);
  assert.equal(battle.foe.hp, hp - 7);
  assert.equal(battle.foe.bleed, 3, 'bleed does not fade');
  assert.equal(battle.foe.burn, 3, 'burn fades by 1');
});

test('Thorns and Entrench (END): attackers take damage back, Block is kept a turn', () => {
  assert.ok(cardThorns(CARDS['spiked-guard'], { ...ZERO, endurance: 10 }) > cardThorns(CARDS['spiked-guard'], ZERO));
  let battle = fight(['spiked-guard', 'entrench', 'guard', 'guard', 'guard'], [{ kind: 'attack', value: 3, hits: 2 }]);
  battle = play(play(battle, 'spiked-guard'), 'entrench');
  assert.equal(battle.thorns, 2);
  assert.equal(battle.block, 9);
  const foeHp = battle.foe.hp;
  battle = endTurn(battle);
  assert.equal(battle.foe.hp, foeHp - 4, 'thorns per hit');
  assert.equal(battle.block, 3, 'leftover block kept by Entrench');
  battle = endTurn(battle);
  assert.equal(battle.block, 0, 'only for one turn');
});

test('Haste and combo (AGI): +1 energy next turn, and the 3rd card each turn gets a bonus', () => {
  let battle = fight(['haste', 'strike', 'strike', 'strike', 'guard'], [{ kind: 'guard', value: 0 }]);
  battle = play(battle, 'haste');
  battle = play(battle, 'strike');
  assert.equal(comboReady(battle), true);
  assert.equal(COMBO_AT, 3);
  const plain = previewDamage({ ...battle, played: 0 }, 'strike');
  assert.equal(previewDamage(battle, 'strike'), plain + comboBonus(ZERO));
  assert.ok(comboBonus({ ...ZERO, agility: 9 }) > comboBonus(ZERO));
  const hp = battle.foe.hp;
  battle = play(battle, 'strike');
  assert.equal(hp - battle.foe.hp, plain + comboBonus(ZERO));
  assert.equal(comboReady(battle), false);
  battle = endTurn(battle);
  assert.equal(battle.energy, 4, 'haste adds one energy next turn');
});

test('Crit (LCK) and gear crit add up, capped at 100%', () => {
  const battle = fight(['strike', 'strike', 'strike', 'strike', 'strike'], [{ kind: 'guard', value: 0 }], { attributes: { ...ZERO, luck: 10 } });
  const base = cardCritChance(battle, CARDS.strike);
  assert.ok(Math.abs(base - 0.3) < 1e-9);
  assert.ok(Math.abs(cardCritChance({ ...battle, passives: ['keen-eye'] }, CARDS.strike) - 0.4) < 1e-9);
});

/* ---------- Gear passives ---------- */

test('every Rare+ drop changes play (passive or bonus card), shown on its tooltip; common/uncommon do not', () => {
  for (const entry of LOOT) {
    const special = !!(entry.passive || entry.grantsCard);
    assert.equal(special, entry.rarity === 'rare' || entry.rarity === 'epic', entry.id);
    if (special) {
      assert.ok(passiveLabel(entry).length > 5);
      assert.equal(gearTooltip(entry), `${bonusLabel(entry)} · ${passiveLabel(entry)}`);
    }
  }
  for (const passive of Object.keys(PASSIVE_TEXT)) assert.ok(LOOT.some((entry) => entry.passive === passive), passive);
});

test('gear passives work in a fight: start Block, twin strike, Burn +1, start Thorns, first dodge', () => {
  const deck = ['strike', 'strike', 'kindle', 'guard', 'guard'];
  const guardOnly = [{ kind: 'guard', value: 0 }];
  assert.equal(fight(deck, guardOnly, { passives: ['start-block'] }).block, 4);
  assert.equal(fight(deck, guardOnly, { passives: ['start-thorns'] }).thorns, 3);
  assert.equal(fight(deck, guardOnly, { passives: ['first-dodge'] }).dodgeNext, true);

  let twin = fight(deck, guardOnly, { passives: ['twin-strike'] });
  assert.equal(previewHits(twin, 'strike'), 2);
  const hp = twin.foe.hp;
  const per = previewDamage(twin, 'strike');
  twin = play(twin, 'strike');
  assert.equal(hp - twin.foe.hp, per * 2, 'first attack hits twice');
  assert.equal(previewHits(twin, 'strike'), 1, 'only the first attack each turn');
  twin = endTurn(twin);
  assert.equal(previewHits(twin, 'strike'), 2, 'resets next turn');

  let burn = fight(deck, guardOnly, { passives: ['burn-plus'] });
  burn = play(burn, 'kindle');
  const before = burn.foe.hp;
  burn = endTurn(burn);
  assert.equal(before - burn.foe.hp, 5, 'Burn 4 ticks for 5');
});

test('worn gear passives and bonus cards reach the fight; nothing when nothing is worn', () => {
  const vault = ['hollow-crown', 'sentinel-plate'];
  assert.deepEqual(loadoutCards({ helm: 'hollow-crown' }), ['insight']);
  assert.deepEqual(loadoutPassives({ armor: 'sentinel-plate' }), ['start-block']);
  const findFight = (state) => {
    const index = state.rows[0].findIndex((room) => room.kind === 'fight');
    return reduceDelve(state, { type: 'choose-room', row: 0, index });
  };
  const worn = findFight(createDelve({ runId: 'r', seed: 5, level: 3, allocated: ZERO, vaultItemIds: vault, wear: vault }));
  const all = [...worn.battle.hand, ...worn.battle.drawPile].map((c) => c.id);
  assert.ok(all.includes('insight'));
  assert.equal(worn.deck.includes('insight'), false, 'the bonus card is not added to your saved deck');
  assert.equal(worn.battle.block, 4);
  const bare = findFight(createDelve({ runId: 'r', seed: 5, level: 3, allocated: ZERO, vaultItemIds: vault }));
  assert.equal(bare.battle.block, 0);
  assert.deepEqual(bare.battle.passives, []);
});

/* ---------- Deck shaping ---------- */

const toPhase = (kind) => {
  for (let seed = 1; seed < 400; seed += 1) {
    const state = createDelve({ runId: 'r', seed, level: 3, allocated: ZERO });
    for (let row = 0; row < state.rows.length; row += 1) {
      const index = state.rows[row].findIndex((room) => room.kind === kind);
      if (index >= 0) return reduceDelve({ ...state, row }, { type: 'choose-room', row, index });
    }
  }
  throw new Error(`no ${kind}`);
};

test('campfire: heal OR remove any one card (never below one hand)', () => {
  const rest = toPhase('rest');
  assert.equal(rest.phase, 'rest');
  const bashIndex = rest.deck.indexOf('bash');
  const removed = reduceDelve(rest, { type: 'rest', choice: 'remove', index: bashIndex });
  assert.equal(removed.phase, 'map');
  assert.equal(removed.deck.length, rest.deck.length - 1);
  assert.equal(removed.deck.includes('bash'), false);
  assert.equal(removed.hp, rest.hp, 'removing does not heal');
  const thin = { ...rest, deck: rest.deck.slice(0, MIN_DECK_SIZE) };
  assert.equal(reduceDelve(thin, { type: 'rest', choice: 'remove', index: 0 }), thin);
  assert.equal(reduceDelve(rest, { type: 'rest', choice: 'remove', index: 99 }), rest);
});

test('treasure: upgrade one card into its "+" version, once', () => {
  const chest = toPhase('treasure');
  assert.equal(chest.phase, 'treasure');
  assert.equal(chest.upgrades, 1);
  const index = chest.deck.indexOf('strike');
  const up = reduceDelve(chest, { type: 'upgrade-card', index });
  assert.equal(up.deck[index], 'strike+');
  assert.equal(up.upgrades, 0);
  assert.equal(cardDef('strike+').name, 'Strike+');
  assert.equal(cardDef('strike+').damage, CARDS.strike.damage + 3);
  assert.match(cardDef('strike+').text, /Upgraded: \+3 damage/);
  assert.equal(reduceDelve(up, { type: 'upgrade-card', index: 0 }), up, 'only one upgrade');
  assert.equal(canUpgradeCard({ ...chest, deck: ['strike+'] }, 0), false, 'no double upgrades');
  const next = reduceDelve(up, { type: 'continue' });
  assert.equal(next.phase, 'map');
  assert.equal(next.upgrades, 0);
  // Upgraded cards play with their new numbers.
  const battle = fight(['strike+', 'strike', 'guard+', 'guard', 'guard'], [{ kind: 'guard', value: 0 }]);
  assert.equal(previewDamage(battle, 'strike+'), previewDamage(battle, 'strike') + 3);
  assert.equal(upgradeDef(CARDS.insight).draw, 3, 'free utility cards draw one more');
});

test('mystery rooms can offer an upgrade', () => {
  const upgradeOptions = EVENTS.flatMap((event) => event.options).filter((option) => option.success.upgrade);
  assert.ok(upgradeOptions.length >= 2);
  const state = createDelve({ runId: 'r', seed: 1, level: 3, allocated: ZERO });
  const ev = { ...state, phase: 'event', event: { eventId: 'whispering-shrine', outcome: null } };
  const after = reduceDelve(ev, { type: 'event-option', optionId: 'meditate' });
  assert.equal(after.upgrades, 1);
  const up = reduceDelve(after, { type: 'upgrade-card', index: 0 });
  assert.ok(up.deck[0].endsWith('+'));
});

/* ---------- UI ---------- */

test('combat UI shows exact incoming damage, status chips with tap-to-explain, gear passives and deck shaping', () => {
  const ui = read('components/crypt/DelveRun.tsx');
  assert.match(ui, /You take <strong>\{incoming\.afterBlock\}/);
  assert.match(ui, /Big hit next turn/);
  assert.match(ui, /function StatusPanel/);
  assert.match(ui, /aria-expanded=\{expanded\}/, 'one Statuses pill, collapsed by default');
  assert.match(ui, /useState\(false\);\n  const \[open, setOpen\]/);
  assert.match(ui, /aria-expanded=\{open === key\}/, 'each chip still taps to explain');
  for (const word of ['Bleed', 'Burn', 'Thorns', 'Haste', 'Combo', 'Crit', 'Hexed']) assert.ok(ui.includes(word), word);
  assert.match(ui, /passiveLabel\(entry\)/);
  assert.match(ui, /Remove a card/);
  assert.match(ui, /Upgrade a card/);
  assert.doesNotMatch(ui, /setTimeout|setInterval|localStorage/);
});
