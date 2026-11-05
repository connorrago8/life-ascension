import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { BROWSER_CONTRACTS, contractReceiptIssues } from './browser-contracts.mjs';

export const REQUIRED_CHECKS = Object.freeze(['source-build', 'browser-smoke', 'boss-boundary', 'unit-tests']);

/** Verify CI evidence only. Passing checks never authorize a merge or deployment. */
export function verifyReleaseReceipts(expectedSha, receipts, jobResults, execution) {
  if (typeof expectedSha !== 'string' || !/^[a-f0-9]{40}$/.test(expectedSha)) throw Error('Expected full candidate SHA is required');
  if (!execution || Array.isArray(execution) || typeof execution.runId !== 'string' || !/^[1-9]\d*$/.test(execution.runId) || typeof execution.runAttempt !== 'string' || !/^[1-9]\d*$/.test(execution.runAttempt)) throw Error('Expected workflow run ID and attempt must be canonical positive decimal strings');
  if (!Array.isArray(receipts) || !jobResults || typeof jobResults !== 'object') throw Error('Receipts and actual job results are required');
  const seen = new Set(), issues = [];
  for (const receipt of receipts) {
    if (!receipt || !REQUIRED_CHECKS.includes(receipt.check)) { issues.push('Unexpected receipt family'); continue; }
    if (seen.has(receipt.check)) issues.push('Duplicate receipt: ' + receipt.check);
    seen.add(receipt.check);
    if (receipt.runId !== execution.runId) issues.push('Workflow run mismatch: ' + receipt.check);
    if (receipt.runAttempt !== execution.runAttempt) issues.push('Workflow attempt mismatch: ' + receipt.check);
    if (receipt.sha !== expectedSha) issues.push('Checkout SHA mismatch: ' + receipt.check);
    if (receipt.result !== 'success') issues.push(receipt.check + ' reported ' + receipt.result);
    if (BROWSER_CONTRACTS[receipt.check]) issues.push(...contractReceiptIssues(receipt.check, expectedSha, receipt.contracts));
    if (jobResults[receipt.check]?.result !== 'success') issues.push(receipt.check + ' job did not succeed');
  }
  for (const check of REQUIRED_CHECKS) if (!seen.has(check)) issues.push('Missing receipt: ' + check);
  if (issues.length) throw Error(issues.join('; '));
  return { sha: expectedSha, runId: execution.runId, runAttempt: execution.runAttempt, verifiedChecks: [...REQUIRED_CHECKS], releaseAuthorized: false };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [sha, directory] = process.argv.slice(2);
    if (!directory) throw Error('Receipt directory is required');
    const receipts = readdirSync(directory).filter(name => name.endsWith('.json'))
      .map(name => JSON.parse(readFileSync(join(directory, name), 'utf8')));
    const execution = { runId: process.env.EXPECTED_RUN_ID, runAttempt: process.env.EXPECTED_RUN_ATTEMPT };
    console.log(JSON.stringify(verifyReleaseReceipts(sha, receipts, JSON.parse(process.env.RELEASE_JOB_RESULTS || '{}'), execution)));
  } catch (error) {
    console.error('Release evidence incomplete: ' + error.message);
    process.exitCode = 1;
  }
}
