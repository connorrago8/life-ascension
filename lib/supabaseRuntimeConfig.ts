// Runtime defense-in-depth for server and Edge auth routes. The build guard
// remains authoritative; this rejects post-build Preview configuration drift.
// The operator must independently pin the intended project's public key.
const PROTECTED_QA_BRANCHES = new Set([
  'audit/qa-isolation-and-reliability-20261027',
  'beta/quest-ui-clean-review',
]);

const PROJECTS: Record<string, string> = {
  production: 'ugcvhmrriazbbymjxvch',
  preview: 'njqwwimzrsunheehnnnt',
  development: 'njqwwimzrsunheehnnnt',
};

export async function readServerSupabaseConfig(): Promise<{ url: string; key: string } | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const target = process.env.VERCEL_ENV;
  if (!target && process.env.VERCEL !== '1') return { url, key }; // Local only.
  const ref = target ? PROJECTS[target] : undefined;
  if (!ref) return null; // Unknown or missing Vercel target: fail closed.
  // Runtime defense if branch metadata drifts after the build-time guard ran.
  if (target === 'preview' && !PROTECTED_QA_BRANCHES.has(process.env.VERCEL_GIT_COMMIT_REF ?? '')) return null;
  // A Preview may receive an injected privileged key after the build. Deny
  // server/Edge public-key clients too, so the QA probe cannot report PASS
  // while a privileged credential is present in this runtime.
  if (target !== 'production' && process.env.SUPABASE_SERVICE_ROLE_KEY) return null;

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.hostname !== `${ref}.supabase.co` ||
        parsed.username || parsed.password || parsed.port || parsed.pathname !== '/' ||
        parsed.search || parsed.hash) return null;

    const pin = process.env.SUPABASE_PUBLIC_KEY_SHA256;
    if (!pin || !/^[a-f0-9]{64}$/i.test(pin) || key.trim() !== key) return null;
    if (key.startsWith('sb_publishable_')) {
      if (key.length <= 'sb_publishable_'.length || /\s/.test(key)) return null;
    } else {
      const parts = key.split('.');
      if (parts.length !== 3 || parts.some(part => !part)) return null;
      const decode = (value: string) =>
        JSON.parse(atob(value.replace(/-/g, '+').replace(/_/g, '/')));
      const header = decode(parts[0]);
      const claims = decode(parts[1]);
      // JWT payload is not a signature check; the independent key pin is required.
      if (header?.alg !== 'HS256' || claims?.iss !== 'supabase' ||
          claims?.role !== 'anon' || claims?.ref !== ref) return null;
    }

    // Web Crypto works in Next.js Edge middleware and Node server routes.
    const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
    const actual = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    if (actual !== pin.toLowerCase()) return null;
    return { url, key };
  } catch {
    return null; // Never log URLs, keys, or fingerprints from auth paths.
  }
}
