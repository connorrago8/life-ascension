import { NextResponse } from 'next/server';
import { applyPendingCookies } from '../supabaseServer.ts';

type Pending = Parameters<typeof applyPendingCookies>[1];

export function engagementJson(body: unknown, status = 200, pending: Pending = []) {
  const response = NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
  return applyPendingCookies(response, pending);
}
