import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { CookieOptions } from '@supabase/ssr';

type CookieToSet = { name: string; value: string; options: CookieOptions };

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  if (!code) return NextResponse.redirect(new URL('/login', url.origin));

  const next = url.searchParams.get('next');
  let destination = '/';
  if(next && !/[\x00-\x1f\x7f]/.test(next) && next.startsWith('/') && !next.startsWith('//') && !next.includes('\\')){
    try{
      const target=new URL(next,url.origin);
      if(target.origin===url.origin)destination=target.pathname+target.search+target.hash;
    }catch{/* fall back home */}
  }
  const response = NextResponse.redirect(new URL(destination, url.origin));
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
  if (error) return NextResponse.redirect(new URL('/login', url.origin));
  return response;
}
