import test from 'node:test';
import assert from 'node:assert/strict';
import { cryptPreviewRequestViolation as violation } from './browser/crypt-network-policy.mjs';

const base = 'http://127.0.0.1:3000';
const check = (method, path) => violation({ method, url: new URL(path, base).href }, base);

test('permits Crypt document and local Next static assets without account access', () => {
  for (const path of ['/play/crypt', '/play/crypt?_rsc=1', '/_next/static/chunks/app.js',
    '/_next/image?url=%2Fhero.png&w=256&q=75', '/favicon.ico', '/images/crypt/rat.png']) {
    assert.equal(check('GET', path), null, path);
  }
});

test('rejects same-origin account API reads, writes and RPCs', () => {
  for (const path of ['/api/quests', '/api/xp', '/api/equipment', '/api/auth/session',
    '/api/quests?limit=1', '/rest/v1/quest_instances', '/graphql']) {
    assert.notEqual(check('GET', path), null, path);
  }
  assert.notEqual(check('POST', '/api/progress'), null);
});

test('rejects Supabase reads and writes, even when they are GET', () => {
  for (const method of ['GET', 'POST']) {
    assert.notEqual(violation({ method, url: 'https://qa-ref.supabase.co/rest/v1/quests' }, base), null);
  }
});

test('rejects off-origin fetches and unexpected local routes', () => {
  assert.notEqual(violation({ method: 'GET', url: 'https://cdn.example.org/script.js' }, base), null);
  assert.notEqual(check('GET', '/account'), null);
  assert.notEqual(check('GET', '/quests'), null);
});

test('rejects non-GET local writes, including static paths', () => {
  assert.notEqual(check('POST', '/play/crypt'), null);
  assert.notEqual(check('DELETE', '/_next/static/chunks/app.js'), null);
});

test('rejects malformed metadata and URL encodings fail-closed', () => {
  assert.notEqual(violation({ method: 'GET', url: 'not-a-url' }, base), null);
  assert.notEqual(violation(null, base), null);
  assert.notEqual(check('GET', '/%XX'), null);
});

test('encoded account endpoint cannot evade local route restrictions', () => {
  assert.notEqual(check('GET', '/%61pi/quests'), null);
  assert.notEqual(check('GET', '/%5Fnext/static/../api/xp'), null);
});
