import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const source = read('components/crypt/DelveRun.tsx');
const css = read('app/style.css');
const combat = source.slice(source.indexOf('function CombatScreen('), source.indexOf('/* ---------- After-room screens ---------- */'));

test('the turn log is screen-reader only; no floating status line above the hand', () => {
  assert.match(combat, /className="delve-log sr-only" role="log" aria-live="polite"/);
  assert.equal((combat.match(/className="delve-log/g) ?? []).length, 1);
});

test('temporary buffs are chips in the Statuses panel, each with a tap explanation', () => {
  const hero = source.slice(source.indexOf('function heroChips('), source.indexOf('function IntentPanel('));
  for (const [field, key] of [['battle.focused', 'focus'], ['battle.block', 'block'], ['battle.dodgeNext', 'dodge'], ['battle.critNext', 'crit'], ['battle.haste', 'haste']]) {
    assert.ok(hero.includes(field), field);
    assert.match(hero, new RegExp(`key: '${key}'`));
  }
  assert.match(source, /loaded: 'Loaded Dice: /);
  assert.match(source, /<ChipRow chips=\{hero\} label="You"/);
});

test('cards: big damage number, small muted arrow and corner combo glyph with accessible text', () => {
  const card = source.slice(source.indexOf('function CardButton('), source.indexOf('/* ---------- After-room screens ---------- */'));
  assert.match(card, /<span className="delve-dmg-num">\{damage\}\{hits\}<\/span>/);
  assert.match(card, /<sup className="delve-dmg-eff" aria-hidden="true"/);
  assert.match(card, /<span className="delve-card-mark" aria-hidden="true"/);
  assert.match(card, /Super effective\./);
  assert.match(card, /Resisted\./);
  assert.match(card, /Combo bonus\./);
  assert.doesNotMatch(card, /' ⛓'|' ↓'|' ★'/);
  assert.match(css, /\.delve-dmg-num \{[^}]*font-size: 1\.2rem/);
  assert.match(css, /\.delve-dmg-eff \{[^}]*font-size: 0\.66rem[^}]*color: var\(--muted\)/);
});

test('only the pressed or keyboard-focused card is strongly highlighted; no blue ring on playable cards', () => {
  assert.doesNotMatch(css, /\.delve-card\.combo \{[^}]*box-shadow/);
  assert.match(css, /\.delve-card, \.delve-card\.kind-attack, \.delve-card\.kind-skill \{ border-color: var\(--border\)/);
  assert.match(css, /\.delve-card:not\(:disabled\):focus-visible \{ outline: 3px solid #f2c46d/);
  assert.match(css, /\.delve-card:disabled \{ opacity: 0\.42/);
});
