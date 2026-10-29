import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { readScopedRunValue, scopeRunValue, toggleScopedRunFlag } from '../lib/crypt/runScopedUi.ts';

const component = readFileSync(new URL('../components/crypt/CryptRun.tsx', import.meta.url), 'utf8');

test('a stale ending-choice callback after Restart cannot preselect the next run', () => {
  let endingChoice = scopeRunValue(101, 'inspect');
  endingChoice = null; // Restart clears the selection.
  endingChoice = scopeRunValue(101, 'leave'); // Old end-screen callback arrives late.
  assert.equal(readScopedRunValue(endingChoice, 202), null);
  assert.equal(readScopedRunValue(endingChoice, 101), 'leave');
});

test('a stale field-journal toggle after Restart cannot reopen notes in the next run', () => {
  let notes = toggleScopedRunFlag(null, 101);
  notes = null; // Restart closes the journal.
  notes = toggleScopedRunFlag(notes, 101); // Old map callback arrives late.
  assert.equal(readScopedRunValue(notes, 202), null);
});

test('current-run ending choices remain visible and journal toggles normally', () => {
  const choice = scopeRunValue(303, 'inspect');
  assert.equal(readScopedRunValue(choice, 303), 'inspect');
  let notes = toggleScopedRunFlag(null, 303);
  assert.equal(readScopedRunValue(notes, 303), true);
  notes = toggleScopedRunFlag(notes, 303);
  assert.equal(readScopedRunValue(notes, 303), false);
});

test('run-scoped UI never mistakes another run for the current one', () => {
  assert.equal(readScopedRunValue(scopeRunValue(11, 'inspect'), 12), null);
  assert.equal(readScopedRunValue(scopeRunValue(12, 'leave'), 12), 'leave');
  assert.equal(readScopedRunValue(null, 12), null);
});

test('CryptRun uses run-scoped reads and writes for both local UI controls', () => {
  assert.match(component, /const activeEndingChoice = readScopedRunValue\(endingChoice, run\.seed\)/);
  assert.match(component, /const fieldNotesOpen = readScopedRunValue\(showFieldNotes, run\.seed\) === true/);
  assert.match(component, /setShowFieldNotes\(\(current\) => toggleScopedRunFlag\(current, run\.seed\)\)/);
  assert.match(component, /setEndingChoice\(scopeRunValue\(run\.seed, 'inspect'\)\)/);
  assert.match(component, /setEndingChoice\(scopeRunValue\(run\.seed, 'leave'\)\)/);
  assert.match(component, /setEndingChoice\(null\)/);
  assert.match(component, /setShowFieldNotes\(null\)/);
  assert.doesNotMatch(component, /endingChoice === 'inspect'/);
  assert.doesNotMatch(component, /showFieldNotes \&\&/);
});
