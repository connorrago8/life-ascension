// Prevent accidental cross-environment Supabase connections during Vercel builds.
// No credentials are logged or embedded in this script.
const PROD = 'ugcvhmrriazbbymjxvch';
const QA = 'njqwwimzrsunheehnnnt';

export function validateDeploymentEnv(env) {
  const target = env.VERCEL_ENV;
  if (!target || !['production', 'preview', 'development'].includes(target)) {
    throw new Error('VERCEL_ENV must explicitly identify production, preview, or development');
  }
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase public URL and client key are required');
  let host;
  try { host = new URL(url).hostname; } catch { throw new Error('Invalid Supabase URL'); }
  const expected = target === 'production' ? PROD : QA;
  if (host !== `${expected}.supabase.co`) {
    throw new Error(`Blocked ${target} build: Supabase project does not match expected environment`);
  }
  if (target !== 'production' && env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Blocked nonproduction build: privileged Supabase service key is present');
  }
  return true;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  try { validateDeploymentEnv(process.env); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
