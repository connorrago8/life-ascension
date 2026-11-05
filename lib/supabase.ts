import { createBrowserClient } from '@supabase/ssr';

// @supabase/ssr stores the session in cookies (persistSession, auto-refresh, 400-day max-age).
// middleware.ts refreshes that cookie on each navigation so the home-screen app stays signed in.
export function supabase() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
