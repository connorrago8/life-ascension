// Integrates Alpha's QA/Production fail-closed build guard into PR #32.
// This checks build configuration, not deployed runtime routing or key authenticity.
import { createHash, timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const projects = { production: 'ugcvhmrriazbbymjxvch', preview: 'njqwwimzrsunheehnnnt', development: 'njqwwimzrsunheehnnnt' };

function keyPairsWithProject(key, ref, pin) {
  if (key.split('.').length === 3) {
    let payload;
    try { payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8')); }
    catch { return false; }
    // Legacy anon JWT ref is a configuration check, not signature validation.
    if (payload?.iss !== 'supabase' || payload?.role !== 'anon' || payload?.ref !== ref) return false;
  } else if (!key.startsWith('sb_publishable_') || !pin) {
    // Opaque keys have no embedded ref; require operator-supplied SHA-256 pin.
    return false;
  }
  if (pin !== undefined) {
    if (!/^[0-9a-f]{64}$/i.test(pin)) return false;
    return timingSafeEqual(Buffer.from(pin, 'hex'), createHash('sha256').update(key).digest());
  }
  return true;
}

export function validateDeploymentEnv(env) {
  const target = env.VERCEL_ENV;
  if (!Object.prototype.hasOwnProperty.call(projects, target)) {
    throw new Error('VERCEL_ENV must explicitly identify production, preview, or development');
  }
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase public URL and client key are required');
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error('Invalid Supabase URL'); }
  if (parsed.protocol !== 'https:' || parsed.hostname !== `${projects[target]}.supabase.co`
      || parsed.username || parsed.password || parsed.port || parsed.pathname !== '/'
      || parsed.search || parsed.hash) {
    throw new Error(`Blocked ${target} build: Supabase project URL mismatch`);
  }
  if (!keyPairsWithProject(key, projects[target], env.SUPABASE_PUBLIC_KEY_SHA256)) {
    throw new Error(`Blocked ${target} build: public key/project pairing not verified`);
  }
  if (target !== 'production' && env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Blocked nonproduction build: privileged Supabase service key is present');
  }
  return true;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { validateDeploymentEnv(process.env); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
