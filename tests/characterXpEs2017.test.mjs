/** Guard Character XP against BigInt literals incompatible with tsconfig ES2017. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('Character XP BigInt checks compile under repository ES2017 target', () => {
  const tsconfig = JSON.parse(readFileSync(new URL('../tsconfig.json', import.meta.url), 'utf8'));
  const helper = readFileSync(new URL('../lib/characterXpProof.ts', import.meta.url), 'utf8');
  assert.equal(tsconfig.compilerOptions.target.toUpperCase(), 'ES2017');
  assert.doesNotMatch(helper, /\b\d+n\b/, 'ES2020 BigInt literal breaks ES2017 compilation');
  assert.match(helper, /value >= BigInt\(0\)/);
});
