import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export function createServiceRoleClient(): SupabaseClient | null {
  if (typeof window !== 'undefined') {
    throw new Error('Supabase service role client is server-only');
  }
  // Runtime defense in depth: a Preview must not create a privileged client,
  // even if a service-role key is injected after the build-time guard runs.
  // Local non-Vercel development keeps its previous behavior.
  const target = process.env.VERCEL_ENV;
  if (target !== 'production' && (target || process.env.VERCEL === '1')) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
