import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { User } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';
import { readServerSupabaseConfig } from '../supabaseRuntimeConfig.ts';

type PendingCookie = { name: string; value: string; options: CookieOptions };

export type EngagementSession = {
  configured: boolean;
  user: User | null;
  db: SupabaseClient | null;
  pending: PendingCookie[];
};

/** Cookie session for subscribe/flush. Uses the anon key and the caller's RLS. */
export async function engagementSession(request: NextRequest): Promise<EngagementSession> {
  const config = await readServerSupabaseConfig();
  if (!config) return { configured: false, user: null, db: null, pending: [] };
  const pending: PendingCookie[] = [];
  const db = createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (items: PendingCookie[]) => { pending.push(...items); },
    },
  });
  try {
    const { data, error } = await db.auth.getUser();
    if (error || !data.user) return { configured: true, user: null, db, pending };
    return { configured: true, user: data.user, db, pending };
  } catch {
    return { configured: true, user: null, db: null, pending };
  }
}

/** Anon client for the cron route and the widget read. No service role. */
export async function engagementAnon(): Promise<SupabaseClient | null> {
  const config = await readServerSupabaseConfig();
  if (!config) return null;
  return createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
