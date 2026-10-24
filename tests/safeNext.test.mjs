import assert from 'node:assert/strict';
import test from 'node:test';
import { safeNext } from '../lib/safeNext.ts';

const origin = 'https://life-ascension.vercel.app';

const payloads = [
  null,
  '',
  '/',
  '/quests',
  '/quests/manage',
  '/settings/api-keys',
  '/?quest=Fold%20laundry&domain=home&cadence=once',
  '/login',
  '/auth/callback',
  '/quests/abc#notes',
  '/quests?x=1',
  '//evil.com',
  '///evil.com',
  '/\\evil.com',
  '\\evil.com',
  'https://evil.com',
  'http://evil.com',
  'https://life-ascension.vercel.app.evil.com',
  '/..//evil.com',
  '/.//evil.com',
  '/%2e%2e//evil.com',
  '/a/..//evil.com',
  '/%09/evil.com',
  '/\t/evil.com',
  '/\n/evil.com',
  '/\r/evil.com',
  'javascript:alert(1)',
  'https://life-ascension.vercel.app/quests',
  '//life-ascension.vercel.app/quests',
  '/%5c/evil.com',
  '/..%2f..%2fevil.com',
  '/quests/..//evil.com',
  '/%2f/evil.com',
  '/foo/../../../evil.com',
  '/@evil.com',
  '/%00/evil.com',
  '/login?next=https://evil.com',
  '/%2e%2e/%2e%2e//evil.com',
  '/evil.com',
  '/#//evil.com',
  'https:evil.com',
  '/quests\n',
];

const collapseToHome = [
  '/..//evil.com',
  '/.//evil.com',
  '/%2e%2e//evil.com',
  '/a/..//evil.com',
  '/%09/evil.com',
  '//evil.com',
  '/\\evil.com',
];

test('safeNext keeps all 42 redirect payloads on the same origin', () => {
  assert.equal(payloads.length, 42);
  for (const next of payloads) {
    const result = safeNext(next, origin);
    const resolved = new URL(result, origin);
    assert.equal(resolved.origin, origin, JSON.stringify(next));
    assert.equal(result.startsWith('/'), true, JSON.stringify(next));
    assert.equal(result.startsWith('//'), false, JSON.stringify(next));
    assert.equal(result.startsWith('/\\'), false, JSON.stringify(next));
  }
});

test('documented open-redirect payloads collapse to the home page', () => {
  for (const next of collapseToHome) {
    assert.equal(safeNext(next, origin), '/', next);
  }
});

test('safe quest and settings paths are preserved', () => {
  assert.equal(safeNext('/quests', origin), '/quests');
  assert.equal(safeNext('/quests/manage', origin), '/quests/manage');
  assert.equal(safeNext('/settings/api-keys', origin), '/settings/api-keys');
  assert.equal(
    safeNext('/?quest=Fold%20laundry&domain=home&cadence=once', origin),
    '/?quest=Fold%20laundry&domain=home&cadence=once',
  );
});
