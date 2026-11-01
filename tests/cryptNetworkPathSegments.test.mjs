import test from 'node:test';
import assert from 'node:assert/strict';
import { cryptPreviewRequestViolation as violation } from './browser/crypt-network-policy.mjs';

const base = 'http://127.0.0.1:3000';
const check = path => violation({method:'GET',url:base + path},base);

test('encoded dot-segment traversal cannot inherit Next static permission', () => {
  assert.notEqual(check('/_next/static/%2e%2e%2fapi%2fxp'), null);
});
test('encoded double-slash aliases cannot inherit Next static permission', () => {
  assert.notEqual(check('/_next/static/%2fapi/xp'), null);
});
test('encoded backslash aliases cannot inherit Next static permission', () => {
  assert.notEqual(check('/_next/static/%5c..%5capi%5cxp'), null);
});
test('ordinary Next static and Crypt document GET still permitted', () => {
  assert.equal(check('/_next/static/chunks/app.js'), null);
  assert.equal(check('/play/crypt'), null);
});
