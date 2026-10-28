import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../app/style.css', import.meta.url), 'utf8');
const home = readFileSync(new URL('../app/(app)/page.tsx', import.meta.url), 'utf8');
const character = readFileSync(new URL('../app/(app)/character/page.tsx', import.meta.url), 'utf8');
const screen = readFileSync(new URL('../components/preview/CharacterScreen.tsx', import.meta.url), 'utf8');

test('quest actions are labelled for assistive technology', () => {
  assert.match(home, /className="actions quest-card-actions" role="group" aria-label=\{\x60Actions for \$\{quest\.title\}\x60\}/);
});

test('mobile quest actions prioritize the completion button', () => {
  assert.match(css, /\.quest-card-actions \.btn \{ min-height: 48px;/);
  assert.match(css, /\.quest-card-actions \.btn:not\(\.ghost\) \{ order: -1;/);
  assert.match(css, /\.quest \{ flex-direction: column; align-items: stretch;/);
});

test('authenticated character never displays sample level', () => {
  assert.match(character, /<CharacterScreen displayName=\{state\.name\} hideSampleStats hideSampleLevel \/>/);
  assert.match(screen, /!hideSampleLevel && <p className="level-line">/);
});
