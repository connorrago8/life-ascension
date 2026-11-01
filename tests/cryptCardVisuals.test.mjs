import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { describeIntent, endTurn, foeIntent, incomingDamage, playCard, startBattle } from '../lib/crypt/delve/battle.ts';
import { CARD_IDS, CARDS, cardDef } from '../lib/crypt/delve/cards.ts';
import { cardFrameClass, cardIcon, ICONS, INTENT_TYPE, intentBadge, playedCard } from '../lib/crypt/delve/cardArt.ts';
import { createDelve, MIN_DECK_SIZE, reduceDelve, removalPreview } from '../lib/crypt/delve/run.ts';
import { seedRng } from '../lib/crypt/delve/rng.ts';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const ui = read('components/crypt/DelveRun.tsx');
const css = read('app/style.css');
const LV1 = { strength: 2, agility: 2, intelligence: 2, endurance: 2, luck: 0 };
const foe = (intents) => ({ id: 'dummy', name: 'Dummy', type: 'rot', sprite: 'rat', rank: 'normal', hp: 999, maxHp: 999, intents });
const battleWith = (intents, deck = ['strike', 'strike', 'guard', 'guard', 'bash']) =>
  startBattle({ rng: seedRng(3), deck, attributes: LV1, hp: 50, maxHp: 50, foe: foe(intents) });

/** Every top-level @media block's prelude and body, with nested braces matched. */
function mediaBlocks(source) {
  const blocks = [];
  const re = /@media[^{]*\{/g;
  let m;
  while ((m = re.exec(source))) {
    let depth = 1; let i = re.lastIndex;
    while (depth > 0 && i < source.length) { if (source[i] === '{') depth += 1; else if (source[i] === '}') depth -= 1; i += 1; }
    blocks.push({ prelude: m[0], body: source.slice(re.lastIndex, i - 1), start: m.index, end: i });
    re.lastIndex = i;
  }
  return blocks;
}

test('every card gets a frame (group + type) and a known inline icon; upgraded cards are marked', () => {
  for (const id of CARD_IDS) {
    const def = CARDS[id];
    const icon = cardIcon(def);
    assert.ok(ICONS[icon], `${id} icon ${icon}`);
    const cls = cardFrameClass(def);
    assert.match(cls, new RegExp(`grp-${def.archetype}`));
    assert.match(cls, new RegExp(`kind-${def.kind}`));
    assert.doesNotMatch(cls, /upgraded/);
    assert.match(cardFrameClass(cardDef(`${id}+`), true), /\bupgraded\b/);
  }
  for (const group of ['basic', 'bruiser', 'combo', 'caster', 'tank', 'luck']) assert.match(css, new RegExp(`\\.grp-${group} \\{ --frame: #`));
  assert.match(css, /\.delve-card\.has-frame\.kind-attack \{/);
  assert.match(css, /\.delve-card\.has-frame\.kind-skill \{/);
  assert.match(css, /\.delve-card\.upgraded \.delve-card-cost \{ box-shadow/);
  // Icons are inline SVG paths, never external images.
  assert.doesNotMatch(ui, /<img |url\(http/);
  for (const { d } of Object.values(ICONS)) assert.match(d, /^[MLHVCSQTAZmlhvcsqtaz0-9 .,-]+$/);
  // Picks follow what the card does.
  assert.equal(cardIcon(CARDS.ember), 'flame');
  assert.equal(cardIcon(CARDS.guard), 'shield');
  assert.equal(cardIcon(CARDS.strike), 'sword');
  assert.equal(cardIcon(CARDS.flurry), 'blades');
  assert.equal(cardIcon(CARDS['loaded-dice']), 'dice');
});

test('intent badge: icon per move type and the same damage number the panel text shows', () => {
  assert.deepEqual(INTENT_TYPE, { attack: 'attack', guard: 'block', roar: 'buff', hex: 'debuff', charge: 'windup' });
  const cases = [
    [{ kind: 'attack', value: 7 }, 'attack', '7'],
    [{ kind: 'attack', value: 4, hits: 3 }, 'attack', '4×3'],
    [{ kind: 'guard', value: 6 }, 'block', '6'],
    [{ kind: 'roar', value: 2 }, 'buff', '+2'],
    [{ kind: 'hex', value: 1 }, 'debuff', '1'],
    [{ kind: 'charge', value: 5 }, 'windup', '5'],
    [{ kind: 'charge', value: 0 }, 'windup', null],
  ];
  for (const [intent, type, value] of cases) {
    const battle = battleWith([intent, { kind: 'attack', value: 20 }]);
    const badge = intentBadge(battle);
    assert.equal(badge.type, type);
    assert.equal(badge.value, value);
    if (intent.kind === 'attack') {
      const incoming = incomingDamage(battle);
      assert.ok(describeIntent(foeIntent(battle), battle.foe).endsWith(value), 'badge number matches Next text');
      assert.equal(incoming.perHit, Number(value.split('×')[0]));
    }
  }
  // Rage and Weaken flow through to the badge exactly like the text.
  const raged = battleWith([{ kind: 'attack', value: 8 }]);
  const weakFoe = { ...raged, foe: { ...raged.foe, strength: 3, weak: 1 } };
  assert.ok(describeIntent(foeIntent(weakFoe), weakFoe.foe).endsWith(intentBadge(weakFoe).value));
  // The existing Next / Then text and big-hit warning stay.
  assert.match(ui, /Next: <strong>\{intentText\(battle\)\}<\/strong>/);
  assert.match(ui, /Then: <Icon/);
  assert.match(ui, /Big hit next turn/);
  assert.match(ui, /<IntentBadge battle=\{battle\} \/>/);
});

test('card-play motion: only the card that just left the hand, never on a new turn', () => {
  let battle = battleWith([{ kind: 'guard', value: 1 }]);
  battle = { ...battle, energy: 10 };
  const first = battle.hand[0];
  const after = playCard(battle, first.uid);
  assert.equal(playedCard(battle, after), first.id);
  assert.equal(playedCard(after, after), null, 're-render with the same state shows nothing new');
  assert.equal(playedCard(null, after), null);
  const next = endTurn(after);
  assert.equal(playedCard(after, next), null, 'end turn is not a card play');
});

test('campfire removal: deck count before → after, confirm step, disabled at the minimum', () => {
  const base = createDelve({ runId: 'r', seed: 11, level: 1, allocated: LV1 });
  const deck14 = [...base.deck, ...base.deck].slice(0, 14);
  assert.equal(deck14.length, 14);
  const preview = removalPreview(deck14, 3);
  assert.deepEqual({ before: preview.before, after: preview.after, allowed: preview.allowed }, { before: 14, after: 13, allowed: true });
  assert.equal(preview.name, cardDef(deck14[3]).name);
  assert.equal(removalPreview(deck14, 99), null);
  // The real reducer lands on exactly the previewed size.
  const rest = { ...base, phase: 'rest', deck: deck14 };
  const removed = reduceDelve(rest, { type: 'rest', choice: 'remove', index: 3 });
  assert.equal(removed.deck.length, preview.after);
  // At the minimum: not allowed, size unchanged, reducer refuses too.
  const min = base.deck.slice(0, MIN_DECK_SIZE);
  const atMin = removalPreview(min, 0);
  assert.deepEqual({ before: atMin.before, after: atMin.after, allowed: atMin.allowed }, { before: MIN_DECK_SIZE, after: MIN_DECK_SIZE, allowed: false });
  const refused = reduceDelve({ ...base, phase: 'rest', deck: min }, { type: 'rest', choice: 'remove', index: 0 });
  assert.equal(refused.deck.length, MIN_DECK_SIZE);
  // UI: before → after, the card, a confirm button, a way back, and the minimum state.
  assert.match(ui, /Deck <strong>\{preview\.before\}<\/strong> <span aria-hidden="true">→<\/span> <strong>\{preview\.after\}<\/strong>/);
  assert.match(ui, /Remove a card \(Deck \$\{size\} → \$\{size - 1\}\)/);
  assert.match(ui, /disabled=\{!canRemove\}/);
  assert.match(ui, /at minimum/);
  assert.match(ui, /className="btn confirm-armed" disabled=\{!preview\.allowed\}/);
  assert.match(ui, /Pick another/);
  assert.match(ui, /onClick=\{\(\) => setPicked\(index\)\}/, 'tapping a card only opens the confirm step');
  assert.match(css, /\.delve-remove-actions \.btn \{ min-height: 44px; \}/);
});

test('reduced-motion guard: every new animation is opt-in, short (≤ 400ms) and fully off under reduce', () => {
  const blocks = mediaBlocks(css);
  const newAnims = ['delve-hit-flash', 'delve-crit-flash', 'delve-hurt-flash', 'delve-hurt-bar', 'delve-card-fly'];
  for (const name of newAnims) {
    assert.match(css, new RegExp(`@keyframes ${name} `), name);
    const uses = [...css.matchAll(new RegExp(`animation:[^;]*\\b${name}\\b[^;]*;`, 'g'))];
    assert.ok(uses.length > 0, `${name} is used`);
    for (const use of uses) {
      const owner = blocks.find((b) => use.index > b.start && use.index < b.end);
      assert.ok(owner && /prefers-reduced-motion: no-preference/.test(owner.prelude), `${name} only under no-preference`);
      for (const [, secs] of use[0].matchAll(/([\d.]+)s\b/g)) assert.ok(Number(secs) <= 0.4, `${name} ${secs}s ≤ 0.4s`);
    }
  }
  // The latest damage/block pop rule is short too.
  const pops = [...css.matchAll(/\.delve-pop \{ animation: delve-pop ([\d.]+)s/g)];
  assert.ok(Number(pops.at(-1)[1]) <= 0.4);
  const reduce = blocks.filter((b) => /prefers-reduced-motion: reduce/.test(b.prelude)).map((b) => b.body).join('\n');
  assert.match(reduce, /\.delve-combat \*, \.delve-combat \*::before, \.delve-combat \*::after \{ animation: none !important; transition: none !important; \}/);
  assert.match(reduce, /\.delve-played \{ display: none; \}/);
  // Never blocks input: overlays ignore taps, and nothing runs on a timer.
  assert.match(css, /\.delve-played \{[^}]*pointer-events: none/);
  assert.match(css, /\.delve-pop \{[^}]*pointer-events: none/);
  for (const file of ['components/crypt/DelveRun.tsx', 'lib/crypt/delve/cardArt.ts', 'lib/crypt/delve/battle.ts', 'lib/crypt/delve/run.ts']) {
    assert.doesNotMatch(read(file), /setTimeout|setInterval|requestAnimationFrame|Date\.now/, file);
  }
});
