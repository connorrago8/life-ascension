import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyQaBrowserBundleAfterBuild } from '../scripts/verify-qa-browser-bundle-after-build.mjs';

const protectedRef = 'audit/qa-isolation-and-reliability-20261027';

test('Production build does not invoke QA-only bundle scanner', async () => {
  const result = await verifyQaBrowserBundleAfterBuild({
    env: { VERCEL_ENV: 'production' },
    inspect: () => { throw new Error('must not inspect Production assets as QA'); },
  });
  assert.deepEqual(result, { skipped: true });
});

test('local development does not invoke QA-only bundle scanner', async () => {
  const result = await verifyQaBrowserBundleAfterBuild({
    env: { VERCEL_ENV: 'development' },
    inspect: () => { throw new Error('must not inspect development assets as QA'); },
  });
  assert.deepEqual(result, { skipped: true });
});

test('Preview from any other branch fails closed before inspecting assets', async () => {
  let called = false;
  await assert.rejects(verifyQaBrowserBundleAfterBuild({
    env: { VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'untrusted/other-preview' },
    inspect: () => { called = true; },
  }), /not the protected QA branch/);
  assert.equal(called, false);
});

test('protected QA Preview inspects emitted assets and returns scanner evidence', async () => {
  let inspectedRoot;
  const result = await verifyQaBrowserBundleAfterBuild({
    env: { VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: protectedRef },
    root: 'synthetic-static-assets',
    inspect: async root => { inspectedRoot = root; return { inspected: 2, qaMatches: 1 }; },
  });
  assert.equal(inspectedRoot, 'synthetic-static-assets');
  assert.deepEqual(result, { skipped: false, inspected: 2, qaMatches: 1 });
});

test('protected QA Preview propagates scanner failure instead of passing', async () => {
  await assert.rejects(verifyQaBrowserBundleAfterBuild({
    env: { VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: protectedRef },
    inspect: async () => { throw new Error('foreign Supabase target'); },
  }), /foreign Supabase target/);
});


test('Emberhaven preview runs the QA scanner and rejects a lookalike ref', async () => {
  const env = { VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'chatgpt/emberhaven-crypt-integration-20261031' };
  const result = await verifyQaBrowserBundleAfterBuild({ env, inspect: async () => ({ inspected: 1, qaMatches: 1 }) });
  assert.equal(result.skipped, false);
  await assert.rejects(verifyQaBrowserBundleAfterBuild({ env: { ...env, VERCEL_GIT_COMMIT_REF: env.VERCEL_GIT_COMMIT_REF + '/other' } }), /protected QA branch/);
});
