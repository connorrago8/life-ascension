import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { User } from '@supabase/supabase-js';

type PendingCookie = { name: string; value: string; options: CookieOptions };

export async function readSessionUser(request: NextRequest): Promise<{
  user: User | null;
  pendingCookies: PendingCookie[];
  configured: boolean;
}> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return { user: null, pendingCookies: [], configured: false };

  const pendingCookies: PendingCookie[] = [];
  const client = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(items: PendingCookie[]) {
        pendingCookies.push(...items);
      },
    },
  });

  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return { user: null, pendingCookies, configured: true };
  return { user: data.user, pendingCookies, configured: true };
}

export function applyPendingCookies(response: NextResponse, pendingCookies: PendingCookie[]) {
  for (const cookie of pendingCookies) {
    response.cookies.set(cookie.name, cookie.value, cookie.options);
  }
  return response;
}
