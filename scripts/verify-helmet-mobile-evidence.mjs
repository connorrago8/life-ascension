#!/usr/bin/env node
// Read-only validator for PR38 browser-captured PNG evidence. No hosted services.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { createHash } from 'node:crypto';

const dir = process.argv[2] || 'artifacts/helmet-mobile-qa';
const manifest = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8'));
const evidence = JSON.parse(await readFile(join(dir, 'sha256-evidence.json'), 'utf8'));
assert.equal(manifest.browserScreenshotsCaptured, true, 'must be real browser captures');
assert.equal(manifest.status, 'proposed-only-no-entitlement');
assert.equal(evidence.visualMode, 'static-proposed-not-owned');
if (process.env.GITHUB_SHA) assert.equal(evidence.sourceCommit, process.env.GITHUB_SHA);
assert.equal(manifest.files.length, 8);
assert.equal(evidence.screenshots.length, 8);
const expected = new Set([320, 375, 390, 430].flatMap(w => ['color', 'grayscale'].map(m => `helmet-${w}-${m}.png`)));
const observed = new Set();
const hashes = new Set();
for (const item of manifest.files) {
  assert.ok([320, 375, 390, 430].includes(item.width));
  assert.ok(['color', 'grayscale'].includes(item.mode));
  const name = `helmet-${item.width}-${item.mode}.png`;
  assert.equal(item.png, name);
  assert.equal(basename(name), name);
  assert.ok(expected.has(name) && !observed.has(name), 'missing or duplicate viewport/mode');
  observed.add(name);
  const bytes = await readFile(join(dir, name));
  assert.deepEqual(bytes.subarray(0, 8), Buffer.from([137,80,78,71,13,10,26,10]), 'invalid PNG signature');
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  assert.equal(width, item.width, 'incorrect screenshot width');
  assert.ok(height >= 380, 'screenshot too short');
  const sha = createHash('sha256').update(bytes).digest('hex');
  const proof = evidence.screenshots.find(x => x.file === name);
  assert.ok(proof, 'missing SHA evidence for screenshot');
  assert.equal(proof.sha256, sha, 'SHA mismatch');
  assert.equal(proof.width, width);
  assert.equal(proof.height, height);
  assert.ok(!hashes.has(sha), 'identical PNG bytes across different captures');
  hashes.add(sha);
}
assert.equal(observed.size, expected.size);
console.log('HELMET_BROWSER_EVIDENCE_PASS: 8 distinct browser PNGs, 4 widths, 2 modes, matching SHA256');
