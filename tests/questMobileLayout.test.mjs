import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../app/style.css', import.meta.url), 'utf8');
const controls = readFileSync(new URL('../components/QuestProgressControls.tsx', import.meta.url), 'utf8');

test('quest cards stack title and actions at iPhone widths', () => {
  assert.match(css, /@media \(max-width: 430px\) \{/);
  assert.match(css, /\.quest \{ flex-direction: column; align-items: stretch;/);
  assert.match(css, /\.quest-main \{ width: 100%; min-width: 0;/);
  assert.match(css, /\.quest-title \{ max-width: 100%; overflow-wrap: anywhere;/);
});

test('progress controls remain visible and keep a one-tap increment', () => {
  assert.match(css, /\.quest-progress-controls \{ width: 100%; min-width: 0;/);
  assert.match(css, /\.quest-progress-controls \.actions \{ display: flex; width: 100%;/);
  assert.match(controls, /onClick=\{\(\) => submit\(Math\.min\(quest\.progress_increment!/);
  assert.match(controls, /Retry save/);
  assert.match(controls, /Saving progress…/);
  assert.match(controls, /Progress saved\./);
  assert.match(controls, /Save not confirmed — retry required\./);
});
