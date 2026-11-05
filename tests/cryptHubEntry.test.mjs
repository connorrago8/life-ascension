import test from 'node:test';
import assert from 'node:assert/strict';
import { createDelve } from '../lib/crypt/delve/run.ts';
import { ACTIVE_RUN_KEY, ACTIVE_RUN_MAX_AGE_MS, saveActiveRun } from '../lib/cryptActiveRun.ts';
import { hubCryptContinuation } from '../lib/cryptHubEntry.ts';

const NOW = 1_800_000_000_000;
const state = () => createDelve({ runId: '00000000-0000-4000-a000-0000000000b8', seed: 17, level: 3, deckSelect: true });
function storageFor(owner = 'guest', savedAt = NOW, run = state()) {
  const entries = new Map();
  const storage = { getItem: k => entries.get(k) ?? null, setItem: (k,v) => entries.set(k,v), removeItem: k => entries.delete(k) };
  saveActiveRun(storage, owner, run, savedAt);
  return storage;
}
test('Hub continuation accepts the actual guest run and rejects another identity or mode', () => {
  assert.equal(hubCryptContinuation(storageFor(), '', true, false, NOW), true);
  for (const owner of ['preview', 'user:alice', 'user:bob']) {
    assert.equal(hubCryptContinuation(storageFor(owner), '', true, false, NOW), false);
  }
});
test('dev preview continues only its own run, even with a configured account client', () => {
  assert.equal(hubCryptContinuation(storageFor('preview'), '?preview=1', true, true, NOW), true);
  assert.equal(hubCryptContinuation(storageFor('guest'), '?preview=1', true, false, NOW), false);
  assert.equal(hubCryptContinuation(storageFor('user:alice'), '?preview=1', true, true, NOW), false);
});
test('query text cannot grant production preview ownership', () => {
  assert.equal(hubCryptContinuation(storageFor('preview'), '?preview=1', false, true, NOW), false);
  assert.equal(hubCryptContinuation(storageFor('guest'), '?preview=1', false, false, NOW), true);
  for (const query of ['?preview=true', '?preview=01', '?preview=0']) {
    assert.equal(hubCryptContinuation(storageFor('preview'), query, true, false, NOW), false);
  }
});
test('configured account client never derives current identity from a save or probes it for wording', () => {
  const storage = { getItem() { throw Error('must not probe unverified ownership'); }, setItem() {}, removeItem() {} };
  assert.equal(hubCryptContinuation(storage, '', true, true, NOW), false);
  for (const owner of ['guest', 'preview', 'user:alice']) {
    assert.equal(hubCryptContinuation(storageFor(owner), '', false, true, NOW), false);
  }
});
test('Hub uses the same expiry and future-time tolerance as Crypt', () => {
  assert.equal(hubCryptContinuation(storageFor('guest', NOW - ACTIVE_RUN_MAX_AGE_MS), '', true, false, NOW), true);
  assert.equal(hubCryptContinuation(storageFor('guest', NOW - ACTIVE_RUN_MAX_AGE_MS - 1), '', true, false, NOW), false);
  assert.equal(hubCryptContinuation(storageFor('guest', NOW + 60_000), '', true, false, NOW), true);
  assert.equal(hubCryptContinuation(storageFor('guest', NOW + 60_001), '', true, false, NOW), false);
});
test('invalid or ended records never promise Continue and remain byte-for-byte untouched', () => {
  const storage = storageFor();
  const valid = JSON.parse(storage.getItem(ACTIVE_RUN_KEY));
  for (const raw of ['{', 'null', '{}', JSON.stringify({ ...valid, v: 2 }), JSON.stringify({ ...valid, state: { ...valid.state, phase: 'defeat' } }), JSON.stringify({ ...valid, state: { ...valid.state, runId: '<invalid>' } })]) {
    storage.setItem(ACTIVE_RUN_KEY, raw);
    assert.equal(hubCryptContinuation(storage, '', true, false, NOW), false);
    assert.equal(storage.getItem(ACTIVE_RUN_KEY), raw);
  }
});
test('unavailable or denied storage produces neutral entry without throwing', () => {
  assert.equal(hubCryptContinuation(null, '', true, false, NOW), false);
  const storage = { getItem() { throw Error('denied'); }, setItem() {}, removeItem() {} };
  assert.equal(hubCryptContinuation(storage, '', true, false, NOW), false);
});
