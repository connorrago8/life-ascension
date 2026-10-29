// Fail closed on cross-project Supabase configuration before any Vercel build.
// The fingerprint must be independently verified against the intended Supabase
// project's public key by the platform operator. Never log or commit the key.
import { createHash, timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const PROTECTED_QA_BRANCHES = new Set(['audit/qa-isolation-and-reliability-20261027', 'beta/quest-ui-clean-review', 'alpha/preview-qa-guard-3087ca33']);
const PRIVILEGED_NONPRODUCTION_KEYS = Object.freeze([
  'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY', 'DATABASE_URL',
  'POSTGRES_URL', 'POSTGRES_PRISMA_URL', 'SUPABASE_DB_PASSWORD',
]);

const PROJECTS = Object.freeze({
  production: 'ugcvhmrriazbbymjxvch',
  preview: 'njqwwimzrsunheehnnnt',
  development: 'njqwwimzrsunheehnnnt',
});

function keyMatchesProject(key, projectRef, fingerprint) {
  if (typeof key !== 'string' || !key || key.trim() !== key ||
      typeof fingerprint !== 'string' || !/^[a-f0-9]{64}$/i.test(fingerprint)) return false;
  const actual = createHash('sha256').update(key).digest();
  if (!timingSafeEqual(actual, Buffer.from(fingerprint, 'hex'))) return false;

  // Modern publishable keys are opaque: only the independently verified
  // fingerprint can bind one to the intended Supabase project.
  if (key.startsWith('sb_publishable_')) {
    return key.length > 'sb_publishable_'.length && !/\s/.test(key);
  }

  // Legacy anon keys embed a project ref, but decoding a JWT is NOT
  // signature verification. The operator-controlled fingerprint is mandatory.
  const parts = key.split('.');
  if (parts.length !== 3 || parts.some(part => !part)) return false;
  try {
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return header?.alg === 'HS256' && claims?.iss === 'supabase' &&
      claims?.role === 'anon' && claims?.ref === projectRef;
  } catch {
    return false;
  }
}

export function validateDeploymentEnv(env) {
  const target = env.VERCEL_ENV;
  if (!Object.prototype.hasOwnProperty.call(PROJECTS, target)) {
    throw new Error('VERCEL_ENV must explicitly identify production, preview, or development');
  }
  // Only the founder-designated protected QA branch may build against the
  // QA Supabase project. Do not trust a Preview URL/key/pin alone: an
  // incorrectly scoped environment override could expose QA to other branches.
  if (target === 'preview' && !PROTECTED_QA_BRANCHES.has(env.VERCEL_GIT_COMMIT_REF)) {
    throw new Error('Blocked preview build: not the protected QA branch');
  }
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase public URL and client key are required');
  let parsed;
  try { parsed = new URL(url); }
  catch { throw new Error('Invalid Supabase URL'); }
  if (parsed.protocol !== 'https:' || parsed.hostname !== `${PROJECTS[target]}.supabase.co` ||
      parsed.username || parsed.password || parsed.port || parsed.pathname !== '/' ||
      parsed.search || parsed.hash) {
    throw new Error(`Blocked ${target} build: Supabase project URL mismatch`);
  }
  if (!keyMatchesProject(key, PROJECTS[target], env.SUPABASE_PUBLIC_KEY_SHA256)) {
    throw new Error(`Blocked ${target} build: public key/project pairing not verified`);
  }
  if (target !== 'production' && PRIVILEGED_NONPRODUCTION_KEYS.some(name =>
    Object.prototype.hasOwnProperty.call(env, name))) {
    throw new Error('Blocked nonproduction build: privileged credential/database variable is present');
  }
  return true;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { validateDeploymentEnv(process.env); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
