import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

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
  assert.match(controls, /const addDelta = nextProgressDelta\(progressBounds, 'add'\)/);
  assert.match(controls, /if \(addDelta !== null\) submit\(addDelta\)/);
  assert.match(controls, /Retry save/);
  assert.match(controls, /Saving progress…/);
  assert.match(controls, /Progress saved\./);
  assert.match(controls, /Save not confirmed — retry required\./);
});


test('retry preserves the original operation ID on network failure or unreadable storage', () => {
  assert.match(controls, /onLog\(instance\.id, pending\.id, pending\.delta\)/);
  assert.match(controls, /Network failures must preserve the original operation ID for retry/);
  assert.match(controls, /Keep the unknown operation intact: never silently replace its ID/);
  assert.doesNotMatch(controls, /Malformed local storage must not permanently lock the quest/);
});

test('new progress actions never reuse or replace a pending request', () => {
  assert.match(controls, /if \(pending\) \{ setRetrying\(true\); return; \}/);
  assert.match(controls, /const operation = \{id: crypto\.randomUUID\(\), delta\};/);
  assert.match(controls, /parsePendingProgress\(localStorage\.getItem\(storageKey\)\)/);
});

test('custom amount cannot change while saving or retrying', () => {
  assert.match(controls, /<input className="field" disabled=\{disabled \|\| saving \|\| retrying \|\| storageError \|\| remaining === 0\}/);
});

test('quest card does not promise XP before authoritative reward confirmation', () => {
  const home = readFileSync(new URL('../app/(app)/page.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(home, /· \+1 XP/);
});

test('definitive progress failures are announced to assistive technology', () => {
  assert.match(controls, /saveState === 'failed' && !retrying && !storageError/);
  assert.match(controls, /<p role="alert">Progress was not saved\. You can try again\.<\/p>/);
});

test('mobile quest card prioritizes completion without removing secondary actions', () => {
  const home = readFileSync(new URL('../app/(app)/page.tsx', import.meta.url), 'utf8');
  assert.match(home, /quest-card-actions/);
  assert.match(home, /aria-label=\{\x60Actions for \$\{quest\.title\}\x60\}/);
  assert.match(css, /\.quest-card-actions \.btn \{ min-height: 48px;/);
  assert.match(css, /\.quest-card-actions \.btn:not\(\.ghost\) \{ order: -1;/);
});

// Ported from PR #41. Source-level regression only: real 200% browser UI zoom still requires
// independent 320/375/390/430px screenshot and focus verification.
test('quest actions stack at high browser zoom while preserving 48px targets', () => {
  assert.match(css, /@media \(max-width: 280px\) \{\s*\.quest-card-actions, \.quest-progress-controls \.actions \{ flex-direction: column; align-items: stretch; \}\s*\.quest-card-actions \.btn, \.quest-progress-controls \.actions \.btn \{ width: 100%; flex: 0 0 auto; min-width: 0; white-space: normal; overflow-wrap: anywhere; \}\s*\.quest-progress-controls \.actions input\[type='number'\] \{ flex: 0 0 auto; width: 100%; max-width: none !important; \}\s*\}/);
  assert.match(css, /\.quest-card-actions \.btn \{ min-height: 48px; flex: 1 1 0; \}/);
  // The zoom rule must come after the 430px rules it overrides.
  assert.ok(css.indexOf('@media (max-width: 280px)') > css.indexOf('.quest-card-actions .btn { min-height: 48px;'));
  assert.ok(css.indexOf('@media (max-width: 280px)') > css.indexOf('.quest-progress-controls .actions input[type=\'number\'] { flex: 1 1 90px;'));
  // Stacked order follows DOM order: Complete comes after Clear in the progress row.
  assert.ok(controls.indexOf('>Clear</button>') < controls.indexOf('<ConfirmCompleteButton label="Complete"'));
});

test('authenticated character hides sample progression level', () => {
  const character = readFileSync(new URL('../app/(app)/character/page.tsx', import.meta.url), 'utf8');
  const screen = readFileSync(new URL('../components/preview/CharacterScreen.tsx', import.meta.url), 'utf8');
  assert.match(character, /equipmentMode=\{state\.preview \? 'preview' : state\.gear \? 'verified' : 'unverified'\}/);
  assert.match(screen, /gearView\.canChange && <p className="level-line">/);
});

test('quest metadata uses progressive disclosure', () => {
  const home = readFileSync(new URL('../app/(app)/page.tsx', import.meta.url), 'utf8');
  assert.match(home, /<QuestDetails quest=\{quest\} instance=\{instance!\}\/>/);
  const componentUrl = new URL('../components/QuestDetails.tsx', import.meta.url);
  const source = readFileSync(componentUrl, 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: {
    jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } });
  const componentModule = { exports: {} };
  new Function('require', 'module', 'exports', compiled.outputText)(
    createRequire(componentUrl), componentModule, componentModule.exports);
  const html = renderToStaticMarkup(createElement(componentModule.exports.QuestDetails, {
    quest: { title: 'Drink water', domain: 'physical_health', cadence: 'daily', quest_type: 'scheduled',
      target_amount: 8, progress_increment: 2, progress_unit: 'glasses' },
    instance: { due_date: '2026-10-29', status: 'available', current_amount: 3 },
  }));
  assert.match(html, /<details class="quest-card-details"><summary aria-label="Quest details for Drink water">Quest details<\/summary>/);
  assert.match(html, /<dt>Recorded progress<\/dt><dd>3 of 8 glasses<\/dd>/);
  assert.doesNotMatch(html, /<details[^>]* open(?:[ =>])/);
});

test('quest details disclosure has a touch target and visible keyboard focus', () => {
  assert.match(css, /\.quest-card-details > summary \{\s*display: flex;\s*align-items: center;\s*min-height: 44px;/);
  assert.match(css, /\.quest-card-details > summary:focus-visible \{\s*outline: 2px solid/);
});

test('progress controls identify their quest for assistive technology', () => {
  const controls = readFileSync(new URL('../components/QuestProgressControls.tsx', import.meta.url), 'utf8');
  assert.match(controls, /Custom progress amount for \$\{quest\.title\}/);
  assert.match(controls, /Retry saving progress for \$\{quest\.title\}/);
  assert.match(controls, /Add \$\{addDelta \?\? 0\} \$\{quest\.progress_unit\} to \$\{quest\.title\}/);
});

test('custom progress amount clears only after confirmed save or retry', () => {
  const controls = readFileSync(new URL('../components/QuestProgressControls.tsx', import.meta.url), 'utf8');
  assert.equal((controls.match(/if \(outcome === 'saved'\) setCustom\(''\);/g) || []).length, 2);
});

test('progress save never sends a new operation when browser storage fails', () => {
  const source = readFileSync(new URL('../components/QuestProgressControls.tsx', import.meta.url), 'utf8');
  assert.match(source, /if \(instance\.status !== 'available' \|\| disabled \|\| saving \|\| operationInFlight\.current \|\| storageError \|\| retrying/);
  assert.match(source, /localStorage\.setItem\(storageKey, JSON\.stringify\(operation\)\); \} catch \{ operationInFlight\.current = false; setStorageError\(true\); return; \}/);
  assert.ok(source.indexOf('localStorage.setItem(storageKey, JSON.stringify(operation))') < source.indexOf('void onLog(instance.id, operation.id, operation.delta)'));
});

test('each progress meter is labelled with its quest title', () => {
  const controls = readFileSync(new URL('../components/QuestProgressControls.tsx', import.meta.url), 'utf8');
  assert.match(controls, /htmlFor=\{`progress-\$\{instance\.id\}`\}>\{quest\.title\}: \{amount\} \/ \{target\}/);
});


test('clear and undo are separate actions using the verified atomic clear contract', () => {
  assert.match(controls, /const clearDelta = nextProgressDelta\(progressBounds, 'clear'\)/);
  assert.match(controls, /if \(undoDelta !== null\) submit\(undoDelta\)/);
  assert.match(controls, /if \(clearDelta !== null\) submit\(clearDelta\)/);
  assert.match(controls, /disabled=\{disabled \|\| saving \|\| retrying \|\| storageError \|\| clearDelta === null\}/);
  assert.match(controls, /aria-label=\{`Clear progress for \$\{quest.title\}`\}/);
  assert.match(controls, /aria-label=\{`Undo \$\{quest.progress_increment\}/);
  assert.match(controls, /if \(instance.status !== 'available' \|\| disabled \|\| saving \|\| operationInFlight\.current \|\| storageError \|\| retrying/);
  assert.match(controls, /const operation = \{id: crypto.randomUUID\(\), delta\}/);
});
