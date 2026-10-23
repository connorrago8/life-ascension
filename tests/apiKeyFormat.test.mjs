import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  cleanKeyName,
  generateApiKey,
  hashApiKey,
  isPersonalApiKey,
  looksLikeApiKeyAttempt,
  readBearerToken,
  secureCompareHex,
} from '../lib/apiKey.ts';

test('generated keys are high entropy and hashed', () => {
  const first = generateApiKey();
  const second = generateApiKey();
  assert.match(first.token, /^la_live_[A-Za-z0-9_-]{43}$/);
  assert.equal(first.prefix, first.token.slice(0, 16));
  assert.equal(first.prefix.length, 16);
  assert.notEqual(first.prefix, first.token);
  assert.equal(first.keyHash, hashApiKey(first.token));
  assert.equal(first.keyHash, createHash('sha256').update(first.token, 'utf8').digest('hex'));
  assert.match(first.keyHash, /^[0-9a-f]{64}$/);
  assert.notEqual(first.keyHash, first.token);
  assert.notEqual(first.token, second.token);
  assert.equal(isPersonalApiKey(first.token), true);
  assert.equal(looksLikeApiKeyAttempt('la_live_short'), true);
  assert.equal(isPersonalApiKey('la_live_short'), false);
});

test('digest compare is exact and rejects uneven input', () => {
  const hash = hashApiKey('la_live_example');
  assert.equal(secureCompareHex(hash, hash), true);
  assert.equal(secureCompareHex(hash, hash.replace(/^./, hash[0] === '0' ? '1' : '0')), false);
  assert.equal(secureCompareHex(hash, hash.toUpperCase()), false);
  assert.equal(secureCompareHex('abc', hash), false);
  assert.equal(secureCompareHex('', ''), false);
});

test('bearer parsing keeps the token intact', () => {
  assert.equal(readBearerToken(null), null);
  assert.equal(readBearerToken('Basic abc'), null);
  assert.equal(readBearerToken('Bearer'), null);
  assert.equal(readBearerToken('Bearer la_live_abc'), 'la_live_abc');
  assert.equal(readBearerToken('bearer la_live_abc'), 'la_live_abc');
  assert.equal(readBearerToken('Bearer la_live_abc\n'), 'la_live_abc');
  assert.equal(readBearerToken('Bearer la_live_abc\nextra'), null);
});

test('key names are trimmed and bounded', () => {
  assert.equal(cleanKeyName('  Laptop   ChatGPT  '), 'Laptop ChatGPT');
  assert.equal(cleanKeyName(''), null);
  assert.equal(cleanKeyName('a'.repeat(81)), null);
  assert.equal(cleanKeyName('line\nbreak'), 'line break');
  assert.equal(cleanKeyName('bad\u0000name'), null);
  assert.equal(cleanKeyName(12), null);
});

test('migration only adds new api and progress objects', () => {
  const sql = readFileSync(new URL('../supabase/migrations/202610230002_api_keys_progress.sql', import.meta.url), 'utf8');
  assert.match(sql, /create table public\.api_keys/i);
  assert.match(sql, /create table public\.quest_progress/i);
  assert.match(sql, /function public\.add_quest_progress/i);
  assert.match(sql, /function public\.authenticate_api_key/i);
  assert.match(sql, /function public\.revoke_api_key/i);
  assert.doesNotMatch(sql, /function\s+public\.(ensure_quest_instance|set_quest_instance_status|create_scheduled_quest|get_lifetime_xp)/i);
  assert.doesNotMatch(sql, /insert\s+into\s+(public\.)?(xp_ledger|quest_events)/i);
  assert.doesNotMatch(sql, /quest_events/i);
  assert.equal(sql.includes('create or replace function public.ensure_quest_instance'), false);
});

test('crypto import stays available to the hasher', () => {
  assert.equal(typeof createHash, 'function');
});
