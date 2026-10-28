import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { validateDeploymentEnv } from '../scripts/verify-deployment-env.mjs';

const qaRef = 'njqwwimzrsunheehnnnt';
const prodRef = 'ugcvhmrriazbbymjxvch';
const pin = key => createHash('sha256').update(key).digest('hex');
const jwt = (ref, role = 'anon') => [
  Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),
  Buffer.from(JSON.stringify({iss:'supabase',ref,role})).toString('base64url'),
  'synthetic-invalid-signature',
].join('.');
const qaKey = jwt(qaRef);
const prodKey = jwt(prodRef);
const qa = {VERCEL_ENV:'preview', NEXT_PUBLIC_SUPABASE_URL:`https://${qaRef}.supabase.co`,
  NEXT_PUBLIC_SUPABASE_ANON_KEY:qaKey, SUPABASE_PUBLIC_KEY_SHA256:pin(qaKey)};
const prod = {VERCEL_ENV:'production', NEXT_PUBLIC_SUPABASE_URL:`https://${prodRef}.supabase.co`,
  NEXT_PUBLIC_SUPABASE_ANON_KEY:prodKey, SUPABASE_PUBLIC_KEY_SHA256:pin(prodKey)};

test('accepts independently pinned QA preview/development and Production fixtures', () => {
  assert.equal(validateDeploymentEnv(qa), true);
  assert.equal(validateDeploymentEnv({...qa, VERCEL_ENV:'development'}), true);
  assert.equal(validateDeploymentEnv(prod), true);
});

test('fails closed on unpinned, placeholder, wrong-fingerprint and malformed keys', () => {
  for (const candidate of [
    {...qa, SUPABASE_PUBLIC_KEY_SHA256:undefined},
    {...qa, SUPABASE_PUBLIC_KEY_SHA256:'0'.repeat(64)},
    {...qa, SUPABASE_PUBLIC_KEY_SHA256:'not-a-sha256'},
    {...qa, NEXT_PUBLIC_SUPABASE_ANON_KEY:'placeholder-public-key',
      SUPABASE_PUBLIC_KEY_SHA256:pin('placeholder-public-key')},
    {...qa, NEXT_PUBLIC_SUPABASE_ANON_KEY:'sb_secret_synthetic',
      SUPABASE_PUBLIC_KEY_SHA256:pin('sb_secret_synthetic')},
    {...qa, NEXT_PUBLIC_SUPABASE_ANON_KEY:jwt(qaRef,'service_role'),
      SUPABASE_PUBLIC_KEY_SHA256:pin(jwt(qaRef,'service_role'))},
  ]) assert.throws(() => validateDeploymentEnv(candidate), /pairing/);
});

test('rejects cross-project URL/key pairing even when mismatched key has its own pin', () => {
  for (const candidate of [
    {...qa, NEXT_PUBLIC_SUPABASE_URL:prod.NEXT_PUBLIC_SUPABASE_URL},
    {...prod, NEXT_PUBLIC_SUPABASE_URL:qa.NEXT_PUBLIC_SUPABASE_URL},
    {...qa, NEXT_PUBLIC_SUPABASE_ANON_KEY:prodKey, SUPABASE_PUBLIC_KEY_SHA256:pin(prodKey)},
    {...prod, NEXT_PUBLIC_SUPABASE_ANON_KEY:qaKey, SUPABASE_PUBLIC_KEY_SHA256:pin(qaKey)},
  ]) assert.throws(() => validateDeploymentEnv(candidate), /Blocked/);
});

test('rejects spoofed hosts, URL credentials, HTTP and query strings', () => {
  for (const url of [
    `https://${qaRef}.supabase.co.evil.example`,
    `http://${qaRef}.supabase.co`,
    `https://user:pass@${qaRef}.supabase.co`,
    `https://${qaRef}.supabase.co/?override=1`,
  ]) assert.throws(() => validateDeploymentEnv({...qa, NEXT_PUBLIC_SUPABASE_URL:url}), /Blocked preview/);
});

test('opaque publishable key requires an independently verified pin', () => {
  const key = 'sb_publishable_synthetic-not-a-real-key';
  assert.throws(() => validateDeploymentEnv({...qa, NEXT_PUBLIC_SUPABASE_ANON_KEY:key}), /pairing/);
  assert.equal(validateDeploymentEnv({...qa, NEXT_PUBLIC_SUPABASE_ANON_KEY:key,
    SUPABASE_PUBLIC_KEY_SHA256:pin(key)}), true);
  assert.throws(() => validateDeploymentEnv({...qa, NEXT_PUBLIC_SUPABASE_ANON_KEY:key,
    SUPABASE_PUBLIC_KEY_SHA256:pin(qaKey)}), /pairing/);
});

test('rejects missing VERCEL_ENV, missing public key and privileged Preview key', () => {
  for (const candidate of [
    {...qa, VERCEL_ENV:undefined},
    {...qa, NEXT_PUBLIC_SUPABASE_ANON_KEY:''},
    {...qa, SUPABASE_SERVICE_ROLE_KEY:'synthetic-service-key'},
  ]) assert.throws(() => validateDeploymentEnv(candidate));
});

test('failure messages do not expose credential contents', () => {
  const bad = {...qa, NEXT_PUBLIC_SUPABASE_ANON_KEY:'synthetic-sensitive-key',
    SUPABASE_PUBLIC_KEY_SHA256:pin('synthetic-sensitive-key')};
  assert.throws(() => validateDeploymentEnv(bad), error => {
    assert.doesNotMatch(error.message, /synthetic-sensitive-key/);
    return true;
  });
});
