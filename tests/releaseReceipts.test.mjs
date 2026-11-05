import test from 'node:test';
import assert from 'node:assert/strict';
import { REQUIRED_CHECKS, verifyReleaseReceipts } from '../scripts/verify-release-receipts.mjs';
const sha = 'a'.repeat(40);
const reports = () => REQUIRED_CHECKS.map(check => ({ check, sha, result: 'success' }));
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
