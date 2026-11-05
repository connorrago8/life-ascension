import assert from 'node:assert/strict';
import test from 'node:test';
import { EMPTY_LANTERN, LANTERN_STORAGE_KEY, loadLanternVisit, saveLanternVisit, parseLanternProgress } from '../lib/lanternRoute.ts';

const solved = { started: true, clues: ['hearth', 'forge', 'market'], placed: ['hearth', 'forge', 'market'], solved: true, kept: true };

test('loading a saved route never writes or replaces it', () => {
  let writes = 0;
  const value = JSON.stringify(solved);
  const loaded = loadLanternVisit(() => ({ getItem: () => value, setItem: () => writes++ }));
  assert.deepEqual(loaded, { progress: solved, readable: true });
  assert.equal(writes, 0);
});

test('storage acquisition and read failures leave a playable, explicitly unreadable visit', () => {
  for (const getStore of [() => { throw new Error('SecurityError'); }, () => null, () => ({ getItem: () => { throw new Error('denied'); } })]) {
    assert.deepEqual(loadLanternVisit(getStore), { progress: EMPTY_LANTERN, readable: false });
  }
});

test('an action is durably available to the next route before save returns', () => {
  const values = new Map();
  const store = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  assert.equal(saveLanternVisit(() => store, solved), true);
  assert.deepEqual(loadLanternVisit(() => store).progress, solved);
  assert.deepEqual([...values.keys()], [LANTERN_STORAGE_KEY]);
});

test('quota errors report failure, preserve the previous save and permit a retry', () => {
  let value = JSON.stringify({ ...EMPTY_LANTERN, started: true });
  let blocked = true;
  const store = { getItem: () => value, setItem: (_, next) => { if (blocked) throw new Error('QuotaExceededError'); value = next; } };
  assert.equal(saveLanternVisit(() => store, solved), false);
  assert.equal(JSON.parse(value).solved, false);
  blocked = false;
  assert.equal(saveLanternVisit(() => store, solved), true);
  assert.deepEqual(loadLanternVisit(() => store).progress, solved);
});

test('a throwing storage getter cannot escape the save action', () => {
  assert.equal(saveLanternVisit(() => { throw new Error('SecurityError'); }, solved), false);
  assert.equal(saveLanternVisit(() => null, solved), false);
});

test('replay reset keeps the existing lantern through save and reload', () => {
  let value;
  const store = { getItem: () => value, setItem: (_, next) => { value = next; } };
  const reset = { ...EMPTY_LANTERN, kept: solved.kept };
  assert.equal(saveLanternVisit(() => store, reset), true);
  assert.deepEqual(loadLanternVisit(() => store).progress, reset);
});

test('old saves without kept retain their completed keepsake', () => {
  const { kept, ...legacy } = solved;
  assert.deepEqual(parseLanternProgress(JSON.stringify(legacy)), solved);
});
