import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const REQUIRED_CHECKS = Object.freeze(['source-build', 'browser-smoke', 'boss-boundary']);

/** Verify CI evidence only. Passing checks never authorize a merge or deployment. */
export function verifyReleaseReceipts(expectedSha, receipts, jobResults) {
  if (typeof expectedSha !== 'string' || !/^[a-f0-9]{40}$/.test(expectedSha)) throw Error('Expected full candidate SHA is required');
  if (!Array.isArray(receipts) || !jobResults || typeof jobResults !== 'object') throw Error('Receipts and actual job results are required');
  const seen = new Set();
  for (const receipt of receipts) {
    if (!receipt || !REQUIRED_CHECKS.includes(receipt.check)) throw Error('Unexpected receipt family');
    if (seen.has(receipt.check)) throw Error('Duplicate receipt: ' + receipt.check);
    seen.add(receipt.check);
    if (receipt.sha !== expectedSha) throw Error('Checkout SHA mismatch: ' + receipt.check);
    if (receipt.result !== 'success') throw Error(receipt.check + ' reported ' + receipt.result);
    if (jobResults[receipt.check]?.result !== 'success') throw Error(receipt.check + ' job did not succeed');
  }
  for (const check of REQUIRED_CHECKS) if (!seen.has(check)) throw Error('Missing receipt: ' + check);
  return { sha: expectedSha, verifiedChecks: [...REQUIRED_CHECKS], releaseAuthorized: false };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [sha, directory] = process.argv.slice(2);
    if (!directory) throw Error('Receipt directory is required');
    const receipts = readdirSync(directory).filter(name => name.endsWith('.json'))
      .map(name => JSON.parse(readFileSync(join(directory, name), 'utf8')));
    console.log(JSON.stringify(verifyReleaseReceipts(sha, receipts, JSON.parse(process.env.RELEASE_JOB_RESULTS || '{}'))));
  } catch (error) {
    console.error('Release evidence incomplete: ' + error.message);
    process.exitCode = 1;
  }
}
