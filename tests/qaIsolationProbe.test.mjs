import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../app/preview/qa-isolation/route.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const sha = 'a'.repeat(40);
const qaUrl = 'https://njqwwimzrsunheehnnnt.supabase.co';
const preview = { VERCEL: '1', VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_SHA: sha };

async function probe(env, { config = { url: qaUrl, key: 'never-exposed' }, admin = null } = {}) {
  const module = { exports: {} };
  const calls = { config: 0, admin: 0 };
  runInNewContext(compiled, {
    module, exports: module.exports, process: { env }, Response,
    require(name) {
      if (name === '../../../lib/supabaseRuntimeConfig') {
        return { async readServerSupabaseConfig() { calls.config++; return config; } };
      }
      if (name === '../../../lib/supabaseAdmin') {
        return { createServiceRoleClient() { calls.admin++; return admin; } };
      }
      throw new Error('Unexpected import ' + name);
    },
  });
  const response = await module.exports.GET();
  const body = response.status === 404 ? null : await response.json();
  return { response, body, calls };
}

test('Preview reports deployment SHA and sanitized source-routing result without secrets', async () => {
  const { response, body, calls } = await probe(preview);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
  assert.equal(body.sha, sha);
  assert.equal(body.serverPublicTarget, 'qa');
  assert.equal(body.privilegedClient, 'denied');
  assert.equal(body.scope, 'runtime-configuration-only');
  assert.doesNotMatch(JSON.stringify(body), /never-exposed|supabase\.co|service_role/);
  assert.equal(calls.config, 1);
  assert.equal(calls.admin, 1);
});

test('Production, local and unknown Vercel targets expose no probe or connection', async () => {
  for (const env of [
    { ...preview, VERCEL_ENV: 'production' },
    { ...preview, VERCEL_ENV: 'development' },
    { ...preview, VERCEL_ENV: 'staging' },
    { ...preview, VERCEL: undefined },
    {},
  ]) {
    const { response, calls } = await probe(env);
    assert.equal(response.status, 404);
    assert.equal(calls.config, 0);
    assert.equal(calls.admin, 0);
  }
});

test('Preview fails closed on absent/mismatched server config, privileged client or unknown SHA', async () => {
  for (const [env, options] of [
    [preview, { config: null }],
    [preview, { config: { url: 'https://wrong.supabase.co', key: 'synthetic' } }],
    [preview, { admin: { dangerous: true } }],
    [{ ...preview, VERCEL_GIT_COMMIT_SHA: undefined }, {}],
    [{ ...preview, VERCEL_GIT_COMMIT_SHA: 'not-a-sha' }, {}],
  ]) {
    const { response, body } = await probe(env, options);
    assert.equal(response.status, 503);
    assert.deepEqual(JSON.parse(JSON.stringify(body)), { status: 'blocked' });
    assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
  }
});
