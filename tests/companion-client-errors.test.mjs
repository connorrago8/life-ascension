import test from 'node:test';
import assert from 'node:assert/strict';
import { companionError } from '../lib/companion/types.ts';
test('unknown backend error detail never becomes companion UI copy', () => {
 for (const code of ['23514','P0001',undefined]) {
  assert.equal(companionError(code,'SECRET reward hidden in SQL error detail').includes('SECRET'),false);
 }
});
test('safe validation and missing-schema messages distinguish unavailable from saved', () => {
 assert.equal(companionError('P0001','A mystery needs a reward promise'),'A mystery needs a reward promise');
 assert.match(companionError('PGRST202'),/not available.*not changed/);
 assert.match(companionError('NETWORK'),/do not assume it was saved/);
});
