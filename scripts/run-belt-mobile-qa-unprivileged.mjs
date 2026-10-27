/**
 * Capture and attest to the 16 proposed Traveler's Belt mobile comparisons.
 * This runner MUST be executed by an unprivileged OS user with Chromium sandbox enabled.
 * It renders local, unauthenticated static HTML only. No Preview, DB, or network calls.
 *
 * Example (after npm ci, as a non-root user):
 *   CHROMIUM_BIN=/usr/bin/chromium node scripts/run-belt-mobile-qa-unprivileged.mjs artifacts/belt-mobile-qa
 *
 * Do not pass --no-sandbox. Do not call the result visually approved until humans inspect PNGs.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputArg = process.argv[2];
assert.ok(outputArg && !outputArg.startsWith('-'),
  'Usage: node scripts/run-belt-mobile-qa-unprivileged.mjs <output-directory>');
assert.ok(typeof process.getuid === 'function' && process.getuid() !== 0,
  'Browser QA requires an unprivileged Unix runner. Refusing root or unverifiable identity.');
const outDir = resolve(outputArg);
const browser = process.env.CHROMIUM_BIN || 'chromium';
execFileSync(browser, ['--version'], { stdio: 'pipe', timeout: 10000 });

execFileSync(process.execPath, [
  join(root, 'scripts/generate-belt-mobile-qa.mjs'), outDir, '--capture',
], { cwd: root, stdio: 'inherit', timeout: 600000 });

const manifest = JSON.parse(await readFile(join(outDir, 'manifest.json'), 'utf8'));
assert.equal(manifest.kind, 'unauthenticated-static-belt-visual-qa');
assert.equal(manifest.status, 'proposed-only-not-owned-or-saved');
assert.equal(manifest.browserScreenshotsCaptured, true);
assert.deepEqual(manifest.widths, [320, 375, 390, 430]);
assert.deepEqual(manifest.hands, ['staff', 'lantern']);
assert.deepEqual(manifest.modes, ['color', 'grayscale']);
assert.equal(manifest.files.length, 16);

const seen = new Set();
const attested = [];
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
for (const item of manifest.files) {
  assert.ok(manifest.widths.includes(item.width));
  assert.ok(manifest.hands.includes(item.hand));
  assert.ok(manifest.modes.includes(item.mode));
  const key = [item.width, item.hand, item.mode].join('-');
  assert.ok(!seen.has(key), 'Duplicate QA combination: ' + key);
  seen.add(key);
  const expectedName = 'belt-' + key + '.png';
  assert.equal(item.png, expectedName, 'Unexpected screenshot name');
  assert.equal(item.html, 'belt-' + key + '.html');
  const bytes = await readFile(join(outDir, item.png));
  assert.ok(bytes.length > 1000, 'Screenshot is suspiciously small: ' + item.png);
  assert.ok(bytes.subarray(0, 8).equals(pngSignature), 'Invalid PNG: ' + item.png);
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  assert.equal(width, item.width, 'Incorrect PNG width: ' + item.png);
  assert.ok(height >= 380, 'Screenshot too short: ' + item.png);
  assert.deepEqual(item.pixelDimensions, { width, height });
  attested.push({
    file: item.png, width, height, bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  });
}
assert.equal(seen.size, 16);
const evidence = {
  status: 'captured-unreviewed',
  note: 'PNG dimensions and hashes verified; contrast, occlusion, and legibility require human visual review.',
  source: 'unauthenticated static HomeCharacter belt comparison; no XP, ownership, DB, or Preview',
  browserVersion: execFileSync(browser, ['--version'], { encoding: 'utf8', timeout: 10000 }).trim(),
  screenshotCount: attested.length,
  screenshots: attested,
};
await writeFile(join(outDir, 'capture-evidence.json'), JSON.stringify(evidence, null, 2) + '\n');
console.log('Verified 16 actual Chromium PNGs; review screenshots and capture-evidence.json in ' + outDir);
