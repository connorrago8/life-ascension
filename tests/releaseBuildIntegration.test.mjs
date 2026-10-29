import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { verifyQaBrowserBundleAfterBuild } from '../scripts/verify-qa-browser-bundle-after-build.mjs';
import { validateDeploymentEnv } from '../scripts/verify-deployment-env.mjs';

const qaRef = 'njqwwimzrsunheehnnnt';
const productionRef = 'ugcvhmrriazbbymjxvch';
const protectedBranch = 'audit/qa-isolation-and-reliability-20261027';

// This is a cross-file release integration check, not a replacement for hosted
// routing, full repository CI, or real iPhone acceptance.
test('build script cannot omit or reorder the two fail-closed QA gates', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const steps = pkg.scripts.build.split(/\s*&&\s*/);
  assert.deepEqual(steps, [
    'node scripts/verify-deployment-env.mjs',
    'next build',
    'node scripts/verify-qa-browser-bundle-after-build.mjs',
  ]);
  assert.doesNotMatch(pkg.scripts.build, /\|\||[;|`]/, 'build gates must not be bypassed');
  assert.match(pkg.scripts.test, /tests\/\*\.test\.mjs/, 'integration regression must run in npm test');
});

test('protected QA post-build gate inspects real emitted JavaScript and rejects a foreign project', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ascension-release-gate-'));
  try {
    const bundle = join(root, 'app.js');
    const env = { VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: protectedBranch };
    await writeFile(bundle, `const url='https://${qaRef}.supabase.co'`);
    const safe = await verifyQaBrowserBundleAfterBuild({ env, root });
    assert.equal(safe.skipped, false);
    assert.equal(safe.qaMatches, 1);
    assert.match(safe.sourceFingerprint, /^[a-f0-9]{16}$/);

    await writeFile(bundle, `const urls=['https://${qaRef}.supabase.co','https://${productionRef}.supabase.co']`);
    await assert.rejects(verifyQaBrowserBundleAfterBuild({ env, root }),
      /foreign Supabase target/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('non-protected Preview cannot pass the post-build gate with a QA-only bundle', async () => {
  const env = { VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'beta/quest-ui-clean-review' };
  await assert.rejects(verifyQaBrowserBundleAfterBuild({ env, root: 'unused' }),
    /not the protected QA branch/);
});

function syntheticQaEnv(branch = protectedBranch) {
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const token = [encode({ alg: 'HS256', typ: 'JWT' }),
    encode({ iss: 'supabase', role: 'anon', ref: qaRef }), 'synthetic-signature'].join('.');
  return {
    VERCEL_ENV: 'preview',
    VERCEL_GIT_COMMIT_REF: branch,
    NEXT_PUBLIC_SUPABASE_URL: `https://${qaRef}.supabase.co`,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: token,
    SUPABASE_PUBLIC_KEY_SHA256: createHash('sha256').update(token).digest('hex'),
  };
}

test('QA prebuild accepts only the protected branch with a pinned QA public key', () => {
  assert.equal(validateDeploymentEnv(syntheticQaEnv()), true);
  assert.throws(() => validateDeploymentEnv(syntheticQaEnv('beta/quest-ui-clean-review')),
    /not the protected QA branch/);
});

test('QA prebuild rejects a Production endpoint even with a matching synthetic key pin', () => {
  const env = syntheticQaEnv();
  env.NEXT_PUBLIC_SUPABASE_URL = `https://${productionRef}.supabase.co`;
  assert.throws(() => validateDeploymentEnv(env), /Supabase project URL mismatch/);
});
