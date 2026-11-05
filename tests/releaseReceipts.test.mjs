import test from 'node:test';
import assert from 'node:assert/strict';
import { REQUIRED_CHECKS, verifyReleaseReceipts } from '../scripts/verify-release-receipts.mjs';
import { BROWSER_CONTRACTS } from '../scripts/browser-contracts.mjs';
const sha = 'a'.repeat(40);
const reports = () => REQUIRED_CHECKS.map(check => ({ check, sha, result: 'success', ...(BROWSER_CONTRACTS[check] ? { contracts: BROWSER_CONTRACTS[check].map(spec => ({ name: spec.name, file: spec.file, sha, result: 'success', exitCode: 0, signal: null, error: null })) } : {}) }));
const jobs = () => Object.fromEntries(REQUIRED_CHECKS.map(check => [check, { result: 'success' }]));

test('all required exact-head successful evidence verifies without release authorization', () => {
  assert.deepEqual(verifyReleaseReceipts(sha, reports(), jobs()), { sha, verifiedChecks: [...REQUIRED_CHECKS], releaseAuthorized: false });
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
