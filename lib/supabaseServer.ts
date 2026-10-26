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

function isPrefetch(request: NextRequest): boolean {
  if (request.headers.has('next-router-prefetch')) return true;
  const purpose = `${request.headers.get('purpose') ?? ''} ${request.headers.get('sec-purpose') ?? ''}`.toLowerCase();
  return purpose.includes('prefetch');
}

/** Refresh the cookie session on a real navigation. Prefetches are skipped so they cannot rotate the refresh token. */
export async function refreshSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (isPrefetch(request)) return response;
  // The item demo is local React state. Skip the session client on that route.
  if (request.nextUrl.pathname === '/character/demo') return response;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return response;

  const client = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(items: PendingCookie[]) {
        for (const { name, value } of items) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of items) response.cookies.set(name, value, options);
      },
    },
  });

  try {
    await client.auth.getUser();
  } catch {
    return response;
  }
  return response;
}
