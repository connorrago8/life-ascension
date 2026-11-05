import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspectQaBrowserBundle } from '../scripts/verify-qa-browser-bundle.mjs';

const QA_HOST = 'njqwwimzrsunheehnnnt.supabase.co';

async function fixture(source, verify) {
  const root = await mkdtemp(join(tmpdir(), 'la-qa-host-boundary-'));
  try {
    await writeFile(join(root, 'chunk.js'), source, 'utf8');
    await verify(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test('rejects QA-host substring inside an attacker-controlled suffix domain', async () => {
  await fixture(`const url='https://${QA_HOST}.attacker.invalid/v1'`, async root => {
    await assert.rejects(inspectQaBrowserBundle(root), /no expected QA Supabase hostname/);
  });
});

test('recognizes exact QA hostname followed by normal URL path or port', async () => {
  for (const target of [`https://${QA_HOST}/rest/v1`, `https://${QA_HOST}:443/rest/v1`]) {
    await fixture(`const url='${target}'`, async root => {
      assert.equal((await inspectQaBrowserBundle(root)).qaMatches, 1);
    });
  }
});

test('does not count a QA host embedded inside a longer label', async () => {
  await fixture(`const url='https://${QA_HOST}-attacker.invalid/rest/v1'`, async root => {
    await assert.rejects(inspectQaBrowserBundle(root), /no expected QA Supabase hostname/);
  });
});

test('does not count a QA hostname nested under an unrelated prefix', async () => {
  await fixture(`const url='https://unexpected.${QA_HOST}/rest/v1'`, async root => {
    await assert.rejects(inspectQaBrowserBundle(root), /no expected QA Supabase hostname/);
  });
});
