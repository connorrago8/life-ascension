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

// Source-level regression only: real 200% browser UI zoom still requires
// independent 320/375/390/430px screenshot and focus verification.
test('quest actions stack at high browser zoom while preserving 48px targets', () => {
  assert.match(css, /@media \(max-width: 280px\) \{\s*\.quest-card-actions \{ flex-direction: column; align-items: stretch; \}\s*\.quest-card-actions \.btn \{ width: 100%; flex: 0 0 auto; min-width: 0; white-space: normal; overflow-wrap: anywhere; \}\s*\}/);
  assert.match(css, /\.quest-card-actions \.btn \{ min-height: 48px; flex: 1 1 0; \}/);
});
