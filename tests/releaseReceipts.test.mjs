import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';
import { REQUIRED_CHECKS, verifyReleaseReceipts as verifyScopedReceipts } from '../scripts/verify-release-receipts.mjs';
import { BROWSER_CONTRACTS } from '../scripts/browser-contracts.mjs';
const sha = 'a'.repeat(40);
const execution = { runId: '42000000000', runAttempt: '2' };
const verifyReleaseReceipts = (sha, receipts, actual, context = execution) => verifyScopedReceipts(sha, receipts, actual, context);
const reports = () => REQUIRED_CHECKS.map(check => ({ check, sha, ...execution, result: 'success', ...(BROWSER_CONTRACTS[check] ? { contracts: BROWSER_CONTRACTS[check].map(spec => ({ name: spec.name, file: spec.file, sha, result: 'success', exitCode: 0, signal: null, error: null })) } : {}) }));
const jobs = () => Object.fromEntries(REQUIRED_CHECKS.map(check => [check, { result: 'success' }]));

test('all required exact-head successful evidence verifies without release authorization', () => {
  assert.deepEqual(verifyReleaseReceipts(sha, reports(), jobs()), { sha, ...execution, verifiedChecks: [...REQUIRED_CHECKS], releaseAuthorized: false });
});
test('a green job from another checkout cannot certify the candidate', () => {
  const r = reports(); r[1].sha = 'b'.repeat(40);
  assert.throws(() => verifyReleaseReceipts(sha, r, jobs()), /SHA mismatch/);
});
test('missing boss evidence fails even when all available checks are green', () => {
  assert.throws(() => verifyReleaseReceipts(sha, reports().slice(0, 2), jobs()), /Missing receipt: boss-boundary/);
});
test('duplicate reports cannot stand in for a missing check', () => {
  const r = reports(); r[2] = { ...r[0] };
  assert.throws(() => verifyReleaseReceipts(sha, r, jobs()), /Duplicate/);
});
test('failed, skipped and cancelled required browser checks never become green', () => {
  for (const result of ['failure', 'skipped', 'cancelled', undefined]) {
    const r = reports(); r[2].result = result;
    assert.throws(() => verifyReleaseReceipts(sha, r, jobs()), /boss-boundary reported/);
  }
});
test('abbreviated, missing and malformed candidate SHAs are rejected', () => {
  for (const value of ['abcdef1', '', undefined, 'g'.repeat(40)]) assert.throws(() => verifyReleaseReceipts(value, reports(), jobs()), /full candidate SHA/);
});
test('an upload or later job failure overrides a stale success receipt', () => {
  const j = jobs(); j['source-build'].result = 'failure';
  assert.throws(() => verifyReleaseReceipts(sha, reports(), j), /job did not succeed/);
});
test('unknown receipt families cannot expand the accepted gate silently', () => {
  assert.throws(() => verifyReleaseReceipts(sha, [...reports(), { check: 'optional', sha, result: 'success' }], jobs()), /Unexpected receipt/);
});
test('missing actual job results and malformed report collections fail closed', () => {
  assert.throws(() => verifyReleaseReceipts(sha, reports(), {}), /job did not succeed/);
  assert.throws(() => verifyReleaseReceipts(sha, null, jobs()), /required/);
});


test('a green browser job without detailed execution receipts cannot certify suites', () => {
  const r = reports(); delete r[1].contracts;
  assert.throws(() => verifyReleaseReceipts(sha, r, jobs()), /Missing contract receipts/);
});
test('all failing groups and missing individual suites appear in one rejection', () => {
  const r = reports(); r[1].result = 'failure'; r[2].result = 'failure';
  r[1].contracts.pop(); r[2].contracts.pop();
  assert.throws(() => verifyReleaseReceipts(sha, r, jobs()), error => {
    for (const issue of ['browser-smoke reported failure', 'boss-boundary reported failure', 'Missing contract: browser-smoke/checkpoint-races', 'Missing contract: boss-boundary/boss-recovery']) assert.ok(error.message.includes(issue));
    return true;
  });
});
test('individual wrong-head, omitted, duplicate, unknown and swapped-file evidence fails closed', () => {
  const mutations = [
    rows => { rows[0].sha = 'b'.repeat(40); },
    rows => { rows.pop(); },
    rows => { rows[1] = { ...rows[0] }; },
    rows => { rows.push({ ...rows[0], name: 'unapproved-suite' }); },
    rows => { rows[0].file = rows[1].file; },
  ];
  for (const mutate of mutations) { const r = reports(); mutate(r[1].contracts); assert.throws(() => verifyReleaseReceipts(sha, r, jobs())); }
});
test('success text cannot conceal failed exit, signal, launch error or missing outcome', () => {
  for (const patch of [{ exitCode: 1 }, { exitCode: null }, { signal: 'SIGKILL' }, { error: 'ETIMEDOUT' }, { result: 'skipped' }, { error: undefined }]) {
    const r = reports(); Object.assign(r[1].contracts[0], patch);
    assert.throws(() => verifyReleaseReceipts(sha, r, jobs()), /Contract failed or incomplete/);
  }
});


test('a successful build and all browsers cannot replace missing unit-test evidence', () => {
  const r = reports().filter(row => row.check !== 'unit-tests');
  assert.throws(() => verifyReleaseReceipts(sha, r, jobs()), /Missing receipt: unit-tests/);
});
test('failed, skipped or cancelled unit tests block independently of successful build evidence', () => {
  for (const result of ['failure', 'skipped', 'cancelled', undefined]) {
    const r = reports(); r.find(row => row.check === 'unit-tests').result = result;
    assert.throws(() => verifyReleaseReceipts(sha, r, jobs()), /unit-tests reported/);
  }
});
test('unit-test upload/job failure overrides its earlier successful receipt', () => {
  const actual = jobs(); actual['unit-tests'].result = 'failure';
  assert.throws(() => verifyReleaseReceipts(sha, reports(), actual), /unit-tests job did not succeed/);
});


test('same SHA and green jobs cannot certify another run or attempt', () => {
  for (const field of ['runId', 'runAttempt']) {
    const r = reports(); r[1][field] = field === 'runId' ? '41999999999' : '1';
    assert.throws(() => verifyReleaseReceipts(sha, r, jobs()), /Workflow (run|attempt) mismatch: browser-smoke/);
  }
});
test('mixed attempts across required families remain blocking', () => {
  const r = reports(); r[0].runAttempt = '1'; r[2].runAttempt = '3';
  assert.throws(() => verifyReleaseReceipts(sha, r, jobs()), error => {
    assert.match(error.message, /Workflow attempt mismatch: source-build/);
    assert.match(error.message, /Workflow attempt mismatch: boss-boundary/); return true;
  });
});
test('missing, numeric and noncanonical receipt identities are not inferred from SHA', () => {
  for (const field of ['runId', 'runAttempt']) for (const value of [undefined, null, 2, '', '0', '02', ' 2', '2.0', '2e0']) {
    const r = reports(); r[0][field] = value;
    assert.throws(() => verifyReleaseReceipts(sha, r, jobs()), /Workflow (run|attempt) mismatch/);
  }
});
test('expected execution identity is mandatory and canonical', () => {
  for (const context of [undefined, null, [], {}, {runId: 42000000000, runAttempt:'2'}, {runId:'42000000000',runAttempt:2}, {runId:'0',runAttempt:'2'}, {runId:'42000000000',runAttempt:'02'}]) {
    assert.throws(() => verifyScopedReceipts(sha, reports(), jobs(), context), /Expected workflow run ID and attempt/);
  }
});
test('partial rerun cannot reuse previous-attempt successes for missing families', () => {
  const r = reports(); r[0].runAttempt = '1';
  assert.throws(() => verifyReleaseReceipts(sha, r, jobs()), /Workflow attempt mismatch/);
  assert.throws(() => verifyReleaseReceipts(sha, r.slice(1), jobs()), /Missing receipt: source-build/);
});
test('execution-bound success still rejects a failed actual job', () => {
  const actual = jobs(); actual['browser-smoke'].result = 'failure';
  assert.throws(() => verifyReleaseReceipts(sha, reports(), actual), /job did not succeed/);
});

function cliFixture(run) {
  const directory = mkdtempSync(join(tmpdir(), 'la-execution-receipts-'));
  try {
    for (const receipt of reports()) writeFileSync(join(directory, receipt.check + '.json'), JSON.stringify(receipt));
    const invoke = (overrides = {}) => spawnSync(process.execPath, ['scripts/verify-release-receipts.mjs', sha, directory], {
      encoding: 'utf8', env: { ...process.env, RELEASE_JOB_RESULTS: JSON.stringify(jobs()), EXPECTED_RUN_ID: execution.runId, EXPECTED_RUN_ATTEMPT: execution.runAttempt, ...overrides },
    });
    run(invoke);
  } finally { rmSync(directory, { recursive: true, force: true }); }
}
test('real CLI binds on-disk receipts to the explicit execution environment', () => {
  cliFixture(invoke => {
    const result = invoke(); assert.equal(result.status, 0, result.stderr);
    const verified = JSON.parse(result.stdout);
    assert.equal(verified.runId, execution.runId); assert.equal(verified.runAttempt, execution.runAttempt); assert.equal(verified.releaseAuthorized, false);
  });
});
test('real CLI rejects absent or stale expected run/attempt without a success result', () => {
  cliFixture(invoke => {
    for (const overrides of [{EXPECTED_RUN_ID:''}, {EXPECTED_RUN_ATTEMPT:''}, {EXPECTED_RUN_ID:'99'}, {EXPECTED_RUN_ATTEMPT:'3'}]) {
      const result = invoke(overrides); assert.equal(result.status, 1);
      assert.match(result.stderr, /Release evidence incomplete/); assert.equal(result.stdout, '');
    }
  });
});
