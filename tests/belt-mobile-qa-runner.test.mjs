import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const runner = fileURLToPath(new URL('../scripts/run-belt-mobile-qa-unprivileged.mjs', import.meta.url));

test('unprivileged screenshot runner parses and requires an explicit output directory', () => {
  const syntax = spawnSync(process.execPath, ['--check', runner], { encoding: 'utf8', timeout: 5000 });
  assert.equal(syntax.status, 0, syntax.stderr);
  const noArg = spawnSync(process.execPath, [runner], { encoding: 'utf8', timeout: 5000 });
  assert.notEqual(noArg.status, 0);
  assert.match(noArg.stderr, /Usage: node scripts\/run-belt-mobile-qa-unprivileged/);
});

test('screenshot runner refuses root and never silently treats HTML as PNG evidence', async () => {
  const source = await readFile(runner, 'utf8');
  assert.match(source, /process\.getuid\(\) !== 0/);
  assert.match(source, /Browser QA requires an unprivileged Unix runner/);
  assert.doesNotMatch(source, /['"]--no-sandbox['"]/);
  assert.match(source, /'--capture'/);
  assert.match(source, /manifest\.browserScreenshotsCaptured, true/);
  assert.match(source, /manifest\.files\.length, 16/);
  assert.match(source, /bytes\.subarray\(0, 8\)\.equals\(pngSignature\)/);
  assert.match(source, /createHash\('sha256'\)/);
  assert.match(source, /status: 'captured-unreviewed'/);
  assert.match(source, /capture-evidence\.json/);
});
