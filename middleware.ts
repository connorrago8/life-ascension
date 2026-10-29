import { NextResponse, type NextRequest } from 'next/server';
import { refreshSession } from './lib/supabaseServer';

export async function middleware(request: NextRequest) {
  // Preview samples and the read-only QA probe must not refresh auth cookies.
  if (request.nextUrl.pathname === '/api/qa-isolation' ||
      request.nextUrl.pathname === '/preview' || request.nextUrl.pathname.startsWith('/preview/')) {
    return NextResponse.next();
  }
  return refreshSession(request);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
