import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../components/crypt/CryptRun.tsx', import.meta.url), 'utf8');

test('field journal describes the accepted bargain even after the inscription note is cleared', () => {
  assert.match(source, /run\.eventChoiceId === 'bargain' \? 'Ember bargain accepted: 2 HP exchanged for \+1 run-only damage\.'/);
});

test('field journal preserves the mending and warning descriptions', () => {
  assert.match(source, /run\.eventChoiceId === 'mend' \? 'Mending words restored health\.'/);
  assert.match(source, /'A warning about the sealed door\.'/);
});
