import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { validateDeploymentEnv } from '../scripts/verify-deployment-env.mjs';

const qaRef = 'njqwwimzrsunheehnnnt';
const qaBranch = 'audit/qa-isolation-and-reliability-20261027';
const prodRef = 'ugcvhmrriazbbymjxvch';
const pin = key => createHash('sha256').update(key).digest('hex');
const jwt = (ref, role = 'anon') => [
  Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),
  Buffer.from(JSON.stringify({iss:'supabase',ref,role})).toString('base64url'),
  'synthetic-invalid-signature',
].join('.');
const qaKey = jwt(qaRef);
const prodKey = jwt(prodRef);
const qa = {VERCEL_ENV:'preview', VERCEL_GIT_COMMIT_REF:qaBranch,
  NEXT_PUBLIC_SUPABASE_URL:`https://${qaRef}.supabase.co`,
  NEXT_PUBLIC_SUPABASE_ANON_KEY:qaKey, SUPABASE_PUBLIC_KEY_SHA256:pin(qaKey)};
const prod = {VERCEL_ENV:'production', NEXT_PUBLIC_SUPABASE_URL:`https://${prodRef}.supabase.co`,
  NEXT_PUBLIC_SUPABASE_ANON_KEY:prodKey, SUPABASE_PUBLIC_KEY_SHA256:pin(prodKey)};

test('accepts independently pinned QA preview/development and Production fixtures', () => {
  assert.equal(validateDeploymentEnv(qa), true);
  assert.equal(validateDeploymentEnv({...qa, VERCEL_ENV:'development'}), true);
  assert.equal(validateDeploymentEnv(prod), true);
});

test('Preview builds reject non-protected branches even with valid QA URL/key/pin', () => {
  assert.equal(validateDeploymentEnv(qa), true);
  for (const ref of [undefined, '', 'main', 'beta/quest-ui-clean-review',
    'audit/qa-isolation-and-reliability-20261027/other']) {
    assert.throws(() => validateDeploymentEnv({ ...qa, VERCEL_GIT_COMMIT_REF: ref }),
      /protected QA branch/);
  }
  // Production remains independently controlled and does not require a QA branch.
  assert.equal(validateDeploymentEnv({ ...prod, VERCEL_GIT_COMMIT_REF: 'main' }), true);
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


// Exercise the actual TypeScript factory with an isolated client constructor.
// These tests never connect to Supabase or use hosted credentials.
const adminSource = readFileSync(new URL('../lib/supabaseAdmin.ts', import.meta.url), 'utf8');
const adminCompiled = ts.transpileModule(adminSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function exerciseAdminFactory(env, browser = false) {
  const calls = [];
  const module = { exports: {} };
  runInNewContext(adminCompiled, {
    module, exports: module.exports, process: { env }, URL,
    ...(browser ? { window: {} } : {}),
    require(name) {
      assert.equal(name, '@supabase/supabase-js');
      return { createClient(url, key, options) {
        calls.push({ url, key, options });
        return { url, key };
      } };
    },
  });
  return { create: () => module.exports.createServiceRoleClient(), calls };
}

test('runtime service-role factory refuses injected keys in all nonproduction Vercel targets', () => {
  for (const target of ['preview', 'development', 'staging']) {
    const { create, calls } = exerciseAdminFactory({
      VERCEL_ENV: target, VERCEL: '1', NEXT_PUBLIC_SUPABASE_URL: qa.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: 'synthetic-privileged-key',
    });
    assert.equal(create(), null);
    assert.equal(calls.length, 0);
  }
  const missingTarget = exerciseAdminFactory({
    VERCEL: '1', NEXT_PUBLIC_SUPABASE_URL: qa.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: 'synthetic-privileged-key',
  });
  assert.equal(missingTarget.create(), null);
  assert.equal(missingTarget.calls.length, 0);
});

test('runtime service-role factory preserves Production and local-only behavior', () => {
  const prodFactory = exerciseAdminFactory({
    VERCEL_ENV: 'production', VERCEL: '1', NEXT_PUBLIC_SUPABASE_URL: prod.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: 'synthetic-privileged-key',
  });
  assert.equal(prodFactory.create().url, prod.NEXT_PUBLIC_SUPABASE_URL);
  assert.equal(prodFactory.calls.length, 1);
  assert.equal(prodFactory.calls[0].options.auth.persistSession, false);
  const absentKey = exerciseAdminFactory({ VERCEL_ENV: 'production',
    NEXT_PUBLIC_SUPABASE_URL: prod.NEXT_PUBLIC_SUPABASE_URL });
  assert.equal(absentKey.create(), null);
  assert.equal(absentKey.calls.length, 0);
  const localFactory = exerciseAdminFactory({
    NEXT_PUBLIC_SUPABASE_URL: qa.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: 'synthetic-local-key',
  });
  assert.equal(localFactory.create().url, qa.NEXT_PUBLIC_SUPABASE_URL);
  assert.equal(localFactory.calls.length, 1);
});

test('rejects privileged runtime URL drift before constructing a Production client', () => {
  for (const url of [
    qa.NEXT_PUBLIC_SUPABASE_URL,
    `http://${prodRef}.supabase.co`,
    `https://${prodRef}.supabase.co.evil.example`,
    `https://user:pass@${prodRef}.supabase.co`,
    `https://${prodRef}.supabase.co/?override=1`,
  ]) {
    const factory = exerciseAdminFactory({
      VERCEL_ENV: 'production', VERCEL: '1',
      NEXT_PUBLIC_SUPABASE_URL: url,
      SUPABASE_SERVICE_ROLE_KEY: 'synthetic-privileged-key',
    });
    assert.equal(factory.create(), null);
    assert.equal(factory.calls.length, 0);
  }
});

test('runtime service-role factory is never callable in the browser', () => {
  const browserFactory = exerciseAdminFactory({ VERCEL_ENV: 'production',
    NEXT_PUBLIC_SUPABASE_URL: prod.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: 'synthetic-privileged-key',
  }, true);
  assert.throws(() => browserFactory.create(), /server-only/);
  assert.equal(browserFactory.calls.length, 0);
});

const runtimeSource = readFileSync(new URL('../lib/supabaseRuntimeConfig.ts', import.meta.url), 'utf8');
const runtimeCompiled = ts.transpileModule(runtimeSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

async function runtimePublicConfig(env) {
  const module = { exports: {} };
  runInNewContext(runtimeCompiled, {
    module, exports: module.exports, process: { env }, URL, TextEncoder, atob, crypto: webcrypto,
  });
  return module.exports.readServerSupabaseConfig();
}

test('runtime server/Edge config accepts only correctly pinned project and target', async () => {
  const qaRuntime = await runtimePublicConfig(qa);
  assert.equal(qaRuntime?.url, qa.NEXT_PUBLIC_SUPABASE_URL);
  assert.equal(qaRuntime?.key, qaKey);
  const prodRuntime = await runtimePublicConfig(prod);
  assert.equal(prodRuntime?.url, prod.NEXT_PUBLIC_SUPABASE_URL);
  assert.equal(prodRuntime?.key, prodKey);
  for (const env of [
    { ...qa, NEXT_PUBLIC_SUPABASE_URL: prod.NEXT_PUBLIC_SUPABASE_URL },
    { ...qa, NEXT_PUBLIC_SUPABASE_ANON_KEY: prodKey, SUPABASE_PUBLIC_KEY_SHA256: pin(prodKey) },
    { ...qa, SUPABASE_PUBLIC_KEY_SHA256: undefined },
    { ...qa, SUPABASE_PUBLIC_KEY_SHA256: '0'.repeat(64) },
    { ...qa, VERCEL_ENV: 'staging' },
    { ...qa, VERCEL_ENV: undefined, VERCEL: '1' },
    { ...qa, SUPABASE_PUBLIC_KEY_SHA256: pin('synthetic-mismatched') },
  ]) assert.equal(await runtimePublicConfig(env), null);
});

test('runtime server/Edge refuses privileged key injected after Preview build', async () => {
  // The build guard rejects this too; runtime drift must not re-enable
  // public-key authentication with a privileged credential present.
  for (const target of ['preview', 'development']) {
    const config = await runtimePublicConfig({
      ...qa, VERCEL_ENV: target, VERCEL: '1',
      SUPABASE_SERVICE_ROLE_KEY: 'synthetic-privileged-key',
    });
    assert.equal(config, null);
  }
  // Production is not blocked merely because its legitimate service key exists.
  const productionConfig = await runtimePublicConfig({
    ...prod, VERCEL: '1', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-privileged-key',
  });
  assert.equal(productionConfig?.url, prod.NEXT_PUBLIC_SUPABASE_URL);
});

test('runtime server/Edge denies unprotected Preview branches after build', async () => {
  // Build-time enforcement alone cannot defend against post-build branch drift.
  assert.equal((await runtimePublicConfig(qa))?.url, qa.NEXT_PUBLIC_SUPABASE_URL);
  for (const ref of [undefined, '', 'main', 'beta/quest-ui-clean-review',
    'audit/qa-isolation-and-reliability-20261027/other']) {
    assert.equal(await runtimePublicConfig({ ...qa, VERCEL_GIT_COMMIT_REF: ref }), null);
  }
  // Production has a separate target and is not tied to the QA branch.
  assert.equal((await runtimePublicConfig({ ...prod, VERCEL_GIT_COMMIT_REF: 'main' }))?.url,
    prod.NEXT_PUBLIC_SUPABASE_URL);
});

test('runtime config leaves non-Vercel local development unchanged', async () => {
  const local = await runtimePublicConfig({
    NEXT_PUBLIC_SUPABASE_URL: qa.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: qaKey,
  });
  assert.equal(local?.url, qa.NEXT_PUBLIC_SUPABASE_URL);
  assert.equal(local?.key, qaKey);
});
