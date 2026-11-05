import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { runContracts } from '../scripts/run-browser-contracts.mjs';
import { BROWSER_CONTRACTS, contractReceiptIssues } from '../scripts/browser-contracts.mjs';
const sha = 'c'.repeat(40);

test('a real failing child is recorded and cannot prevent the next real child executing', () => {
  const directory = mkdtempSync(join(tmpdir(), 'la-contracts-'));
  try {
    const marker = join(directory, 'executed.txt');
    const first = join(directory, 'first.mjs'), second = join(directory, 'second.mjs');
    writeFileSync(first, 'process.exitCode = 7;');
    writeFileSync(second, `import { writeFileSync } from 'node:fs'; writeFileSync(${JSON.stringify(marker)}, 'ran after failure');`);
    const progress = [];
    const rows = runContracts([{ name: 'first', file: first }, { name: 'second', file: second }], sha, {
      execute: args => spawnSync(process.execPath, args), onProgress: rows => progress.push(rows.length),
    });
    assert.equal(readFileSync(marker, 'utf8'), 'ran after failure');
    assert.deepEqual(rows.map(row => [row.result, row.exitCode]), [['failure', 7], ['success', 0]]);
    assert.deepEqual(progress, [0, 1, 2]);
    assert.ok(rows.every(row => row.sha === sha));
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
test('launch errors, signals, timeouts and throwing executors remain failures while later suites run', () => {
  const outcomes = [{ error: { code: 'ENOENT' } }, { status: 0, signal: 'SIGTERM' }, { status: null, signal: 'SIGKILL', error: { code: 'ETIMEDOUT' } }, 'throws', { status: 0 }];
  const rows = runContracts(outcomes.map((_, i) => ({ name: String(i), file: 'fixture.mjs' })), sha, { execute: () => {
    const next = outcomes.shift(); if (next === 'throws') throw Error('executor failed'); return next;
  } });
  assert.deepEqual(rows.map(row => row.result), ['failure', 'failure', 'failure', 'failure', 'success']);
  assert.equal(rows[2].error, 'ETIMEDOUT');
});
test('required manifest covers every current browser suite once and points to actual files', () => {
  const entries = Object.values(BROWSER_CONTRACTS).flat();
  assert.equal(entries.length, 22);
  assert.equal(new Set(entries.map(row => row.file)).size, entries.length);
  for (const row of entries) assert.ok(existsSync(row.file), row.file);
  assert.deepEqual(contractReceiptIssues('unknown', sha, []), ['Unknown browser group: unknown']);
});
test('actual timeout produces a failed receipt and does not hide a following successful process', () => {
  const rows = runContracts([{ name: 'timeout', file: 'hang' }, { name: 'next', file: 'pass' }], sha, { execute: args =>
    spawnSync(process.execPath, ['-e', args.at(-1) === 'hang' ? 'setInterval(()=>{},1000)' : 'process.exit(0)'], { timeout: args.at(-1) === 'hang' ? 150 : 2000, killSignal: 'SIGKILL' }),
  });
  assert.equal(rows[0].result, 'failure'); assert.equal(rows[0].error, 'ETIMEDOUT');
  assert.equal(rows[1].result, 'success');
});
