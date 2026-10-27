import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

test('opt-in L1/L5 helmet visual fixture is source-rendered without earned gear', () => {
  const dir = mkdtempSync(join(tmpdir(), 'helmet-visual-contract-'));
  try {
    const result = spawnSync(process.execPath, ['scripts/generate-helmet-mobile-qa.mjs', dir], {
      encoding: 'utf8', timeout: 30000,
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
    assert.equal(manifest.kind, 'source-backed-opt-in-helmet-visual-qa');
    assert.equal(manifest.status, 'proposed-only-no-entitlement');
    assert.equal(manifest.browserScreenshotsCaptured, false);
    assert.deepEqual(manifest.widths, [320, 375, 390, 430]);
    assert.equal(manifest.files.length, 8);
    for (const item of manifest.files) {
      const html = readFileSync(join(dir, item.html), 'utf8');
      assert.match(html, /data-waist-part="starter-tie"/);
      assert.doesNotMatch(html, /data-waist-part="earned-buckle"/);
      assert.equal((html.match(/data-helmet-preview="proposed"/g) || []).length, 1);
      assert.equal((html.match(/data-prop="staff"/g) || []).length, 2);
      assert.match(html, /PROPOSED ART · NOT EARNED, OWNED, EQUIPPED OR SAVED/);
      assert.match(html, /viewBox="0 0 240 380"/);
      if (item.mode === 'grayscale') assert.match(html, /filter:grayscale\(1\)/);
      if (item.width === 320) assert.match(html, /Character evolution · 320px/);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
