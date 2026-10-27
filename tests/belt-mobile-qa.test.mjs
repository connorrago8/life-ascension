import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('offline belt QA generates 16 full-character static comparisons without browser or backend', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'belt-mobile-qa-'));
  try {
    const script = new URL('../scripts/generate-belt-mobile-qa.mjs', import.meta.url);
    execFileSync(process.execPath, [script.pathname, dir], { timeout: 30000 });
    const manifest = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8'));
    assert.equal(manifest.kind, 'unauthenticated-static-belt-visual-qa');
    assert.equal(manifest.status, 'proposed-only-not-owned-or-saved');
    assert.equal(manifest.browserScreenshotsCaptured, false);
    assert.deepEqual(manifest.widths, [320, 375, 390, 430]);
    assert.deepEqual(manifest.hands, ['staff', 'lantern']);
    assert.deepEqual(manifest.modes, ['color', 'grayscale']);
    assert.equal(manifest.files.length, 16);
    for (const item of manifest.files) {
      const html = await readFile(join(dir, item.html), 'utf8');
      assert.match(html, /<meta name="viewport"/);
      assert.match(html, /Preview only|Visual QA only/i);
      assert.match(html, /data-belt-stage="starter"/);
      assert.match(html, /data-belt-stage="equipped"/);
      assert.match(html, /data-waist-part="starter-tie"/);
      assert.match(html, /data-waist-part="earned-buckle"/);
      assert.match(html, /role="img"/);
      assert.match(html, new RegExp('data-prop="' + item.hand + '"'));
      assert.doesNotMatch(html, /M96 111 L141 216/);
      assert.equal(item.png, undefined, 'HTML output is not screenshot evidence');
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
