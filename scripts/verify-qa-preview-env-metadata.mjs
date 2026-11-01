import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Read-only metadata gate. This does NOT inspect/decrypt values, resolve effective
// Vercel precedence, or attest browser/server/privileged runtime routing.
export const PROTECTED_QA_BRANCH = 'audit/qa-isolation-and-reliability-20261027';
export const APPROVED_QA_BRANCHES = new Set([PROTECTED_QA_BRANCH, 'beta/quest-ui-clean-review', 'chatgpt/emberhaven-crypt-integration-20261031']);
const REQUIRED = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_PUBLIC_KEY_SHA256',
];
const PRIVILEGED = new Set([
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_SECRET_KEY',
  'DATABASE_URL',
  'POSTGRES_URL',
  'POSTGRES_PRISMA_URL',
  'SUPABASE_DB_PASSWORD',
]);

export function verifyQaPreviewEnvMetadata(snapshot, branch = PROTECTED_QA_BRANCH) {
  const blockers = [];
  if (!APPROVED_QA_BRANCHES.has(branch)) blockers.push('wrong-protected-qa-branch');
  const envs = snapshot?.result?.envs ?? snapshot?.envs;
  if (!Array.isArray(envs)) {
    return { ok: false, metadata_only: true, runtime_verified: false, blockers: [...blockers, 'missing-env-metadata'] };
  }
  if (envs.some(e => !e || typeof e.key !== 'string' || !Array.isArray(e.target) ||
      e.target.some(t => t !== 'preview' && t !== 'production' && t !== 'development'))) {
    blockers.push('invalid-env-metadata');
  }
  for (const key of REQUIRED) {
    const scoped = envs.filter(e => e?.key === key && e.gitBranch === branch);
    if (scoped.length !== 1 || scoped[0]?.target?.length !== 1 || scoped[0]?.target?.[0] !== 'preview') {
      blockers.push('missing-duplicate-or-mis-scoped-' + key);
    }
  }
  // A privileged key with any Preview target is unsafe regardless of branch.
  // Production-only service-role metadata is allowed, but never proof of isolation.
  if (envs.some(e => PRIVILEGED.has(e?.key) && e?.target?.includes('preview'))) {
    blockers.push('privileged-preview-variable-present');
  }
  // Branch-scoped overrides for the protected branch must not target Production.
  if (envs.some(e => e?.gitBranch === branch && e?.target?.includes('production'))) {
    blockers.push('protected-branch-variable-targets-production');
  }
  return { ok: blockers.length === 0, metadata_only: true, runtime_verified: false, blockers };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const snapshot = JSON.parse(readFileSync(0, 'utf8'));
    const result = verifyQaPreviewEnvMetadata(snapshot, process.argv[2] ?? PROTECTED_QA_BRANCH);
    if (result.ok) {
      process.stdout.write('PASS: protected QA Preview variable metadata only; runtime NOT verified.\n');
    } else {
      process.stderr.write('BLOCKED: ' + result.blockers.join('; ') + '; runtime NOT verified.\n');
      process.exitCode = 1;
    }
  } catch {
    process.stderr.write('BLOCKED: unreadable metadata; runtime NOT verified.\n');
    process.exitCode = 1;
  }
}
