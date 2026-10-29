import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspectQaBrowserBundle } from '../scripts/verify-qa-browser-bundle.mjs';

const qa = 'https://njqwwimzrsunheehnnnt.supabase.co';
const prod = 'https://ugcvhmrriazbbymjxvch.supabase.co';
const foreign = 'https://abcdefghijklmnopqrst.supabase.co';

async function fixture(files, check) {
  const root = await mkdtemp(join(tmpdir(), 'life-ascension-qa-bundle-'));
  try {
    for (const [path, content] of Object.entries(files)) {
      const destination = join(root, path);
      await mkdir(join(destination, '..'), { recursive: true });
      await writeFile(destination, content);
    }
    return await check(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test('accepts QA-only emitted JS and ignores non-browser assets', async () => {
  await fixture({ 'a.js': "const url='" + qa + "'", 'nested/b.mjs': "fetch('" + qa + "')",
    'map.txt': prod }, async root => {
    const result = await inspectQaBrowserBundle(root);
    assert.equal(result.inspected, 2);
    assert.equal(result.qaMatches, 2);
    assert.equal(result.foreignHosts, 0);
    assert.match(result.sourceFingerprint, /^[a-f0-9]{16}$/);
  });
});

test('rejects foreign project even when the expected QA hostname is present', async () => {
  await fixture({ 'a.js': "const urls=['" + qa + "','" + foreign + "']" }, async root => {
    await assert.rejects(inspectQaBrowserBundle(root), /foreign Supabase target/);
  });
});

test('rejects known Production ref even when it is not a full URL', async () => {
  await fixture({ 'a.js': "const url='" + qa + "'; const ref='ugcvhmrriazbbymjxvch'" }, async root => {
    await assert.rejects(inspectQaBrowserBundle(root), /foreign Supabase target/);
  });
});

test('rejects privileged markers in emitted browser assets', async () => {
  for (const marker of ['sb_secret_synthetic_test', 'SUPABASE_SERVICE_ROLE_KEY']) {
    await fixture({ 'a.js': "const url='" + qa + "'; const marker='" + marker + "'" }, async root => {
      await assert.rejects(inspectQaBrowserBundle(root), /privileged marker/);
    });
  }
});

test('fails closed when no QA hostname is emitted', async () => {
  await fixture({ 'a.js': 'const ok=true;' }, async root => {
    await assert.rejects(inspectQaBrowserBundle(root), /no expected QA Supabase hostname/);
  });
});

test('source fingerprint changes when the QA-bearing browser asset changes', async () => {
  await fixture({ 'a.js': "const url='" + qa + "'" }, async root => {
    const before = await inspectQaBrowserBundle(root);
    await writeFile(join(root, 'a.js'), "const url='" + qa + "'; const version=2");
    const after = await inspectQaBrowserBundle(root);
    assert.notEqual(before.sourceFingerprint, after.sourceFingerprint);
  });
});

// New P0 regressions: all tokens are synthetic, never hosted credentials.
function syntheticJwt(role, ref = 'njqwwimzrsunheehnnnt') {
  const b64 = obj => Buffer.from(JSON.stringify(obj)).toString('base64url');
  return [b64({ alg: 'HS256', typ: 'JWT' }), b64({ iss: 'supabase', ref, role }), 'syntheticsignature123'].join('.');
}

test('rejects service_role JWT embedded without a privileged variable name', async () => {
  await fixture({ 'a.js': `const endpoint='${qa}';const token='${syntheticJwt('service_role')}'` }, async root => {
    await assert.rejects(inspectQaBrowserBundle(root), /privileged marker/);
  });
});

test('rejects case-varied raw Production project ref without a Production URL', async () => {
  await fixture({ 'a.js': `const endpoint='${qa}';const ref='UGCVHMRRIAZBBYMJXVCH'` }, async root => {
    await assert.rejects(inspectQaBrowserBundle(root), /foreign Supabase target/);
  });
});

test('allows synthetic QA anon JWT while still requiring QA URL', async () => {
  await fixture({ 'a.js': `const endpoint='${qa}';const token='${syntheticJwt('anon')}'` }, async root => {
    assert.equal((await inspectQaBrowserBundle(root)).qaMatches, 1);
  });
});

test('rejects Production-ref anon JWT even if a QA URL is also present', async () => {
  const productionRef = 'ugcvhmrriazbbymjxvch';
  await fixture({ 'a.js': `const endpoint='${qa}';const token='${syntheticJwt('anon', productionRef)}'` }, async root => {
    await assert.rejects(inspectQaBrowserBundle(root), /foreign Supabase target|privileged marker/);
  });
});

test('does not crash on a malformed JWT-like payload', async () => {
  const malformed = ['eyJhbGciOiJIUzI1NiJ9', 'eyJub3Q6anNvbg', 'syntheticsignature123'].join('.');
  await fixture({ 'a.js': `const endpoint='${qa}';const token='${malformed}'` }, async root => {
    assert.equal((await inspectQaBrowserBundle(root)).qaMatches, 1);
  });
});
