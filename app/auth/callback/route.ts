import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { CookieOptions } from '@supabase/ssr';
import { requestOrigin } from '../../../lib/requestOrigin';
import { safeNext } from '../../../lib/safeNext';

type CookieToSet = { name: string; value: string; options: CookieOptions };

function loginAgain(origin: string, next: string | null) {
  const destination = safeNext(next, origin);
  return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(destination)}`, origin));
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const origin = requestOrigin(request);
  const code = url.searchParams.get('code');
  if (!code) return loginAgain(origin, url.searchParams.get('next'));

  const destination = safeNext(url.searchParams.get('next'), origin);
  const response = NextResponse.redirect(new URL(destination, origin));
  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(items: CookieToSet[]) {
          items.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { error } = await client.auth.exchangeCodeForSession(code);
  if (error) return loginAgain(origin, url.searchParams.get('next'));
  return response;
}
