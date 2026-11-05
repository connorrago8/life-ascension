import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspectQaBrowserBundle } from '../scripts/verify-qa-browser-bundle.mjs';

const qa = 'https://njqwwimzrsunheehnnnt.supabase.co';
const production = 'https://ugcvhmrriazbbymjxvch.supabase.co';

async function fixture(files, callback) {
  const root = await mkdtemp(join(tmpdir(), 'life-qa-sourcemap-'));
  try {
    for (const [filename, source] of Object.entries(files)) {
      await writeFile(join(root, filename), source);
    }
    return await callback(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test('rejects Production reference only in public JS source map', async () => {
  await fixture({ 'app.js': `const endpoint='${qa}'`, 'app.js.map': JSON.stringify({sourcesContent:[`const target='${production}'`]}) }, async root => {
    await assert.rejects(inspectQaBrowserBundle(root), /foreign Supabase target/);
  });
});

test('rejects privileged marker only in public MJS source map', async () => {
  await fixture({ 'app.mjs': `const endpoint='${qa}'`, 'app.mjs.map': JSON.stringify({sourcesContent:['const key="SUPABASE_SERVICE_ROLE_KEY"']}) }, async root => {
    await assert.rejects(inspectQaBrowserBundle(root), /privileged marker/);
  });
});

test('public source map changes browser source fingerprint without increasing JS count', async () => {
  await fixture({ 'app.js': `const endpoint='${qa}'`, 'app.js.map': '{"version":3,"sourcesContent":["a"]}' }, async root => {
    const first = await inspectQaBrowserBundle(root);
    await writeFile(join(root, 'app.js.map'), '{"version":3,"sourcesContent":["b"]}');
    const second = await inspectQaBrowserBundle(root);
    assert.equal(first.inspected, 1);
    assert.equal(second.inspected, 1);
    assert.equal(first.qaMatches, 1);
    assert.notEqual(first.sourceFingerprint, second.sourceFingerprint);
  });
});

test('QA URL only in a source map cannot satisfy emitted JS routing requirement', async () => {
  await fixture({ 'app.js': 'const ok=true', 'app.js.map': JSON.stringify({sourcesContent:[qa]}) }, async root => {
    await assert.rejects(inspectQaBrowserBundle(root), /no expected QA Supabase hostname/);
  });
});
