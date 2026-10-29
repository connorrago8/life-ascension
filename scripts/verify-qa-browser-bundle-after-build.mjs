// Run Alpha's browser-bundle scanner after Next.js has emitted static assets.
// This is a source-build gate, not evidence of hosted QA runtime isolation.
import { pathToFileURL } from 'node:url';
import { inspectQaBrowserBundle } from './verify-qa-browser-bundle.mjs';

const PROTECTED_QA_BRANCH = 'audit/qa-isolation-and-reliability-20261027';

export async function verifyQaBrowserBundleAfterBuild({
  env = process.env,
  root = '.next/static',
  inspect = inspectQaBrowserBundle,
} = {}) {
  // Production and local development must not be scanned as though they were QA.
  if (env.VERCEL_ENV !== 'preview') return { skipped: true };
  // Repeat the protected-branch condition here so this gate fails closed if
  // the prebuild guard is accidentally removed or its invocation changes.
  if (env.VERCEL_GIT_COMMIT_REF !== PROTECTED_QA_BRANCH) {
    throw new Error('QA browser bundle scan blocked: not the protected QA branch');
  }
  const result = await inspect(root);
  return { skipped: false, ...result };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await verifyQaBrowserBundleAfterBuild();
    console.log(result.skipped ? 'QA browser bundle scan skipped for non-Preview build' :
      'QA browser bundle scan PASS', result.skipped ? '' : result);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
