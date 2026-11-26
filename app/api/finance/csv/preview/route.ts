import { NextRequest, NextResponse } from 'next/server';
import { parseMonarchCsv } from '../../../../../lib/ascension/monarchCsv';
import { applyPendingCookies, readSessionUser } from '../../../../../lib/supabaseServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Owner session only. Returns the row count and date range. Does not store the file or log rows. */
export async function POST(request: NextRequest) {
  const session = await readSessionUser(request);
  if (!session.configured) return json({ error: 'Server not configured' }, 503, session.pendingCookies);
  if (!session.user) return json({ error: 'Sign-in required' }, 401, session.pendingCookies);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid finance import' }, 400, session.pendingCookies);
  }
  const csv = body && typeof body === 'object' && !Array.isArray(body) ? (body as { csv?: unknown }).csv : null;
  if (typeof csv !== 'string') return json({ error: 'Invalid finance import' }, 400, session.pendingCookies);
  try {
    const parsed = parseMonarchCsv(csv);
    return json({ rowCount: parsed.rowCount, dateStart: parsed.dateStart, dateEnd: parsed.dateEnd }, 200, session.pendingCookies);
  } catch {
    return json({ error: 'Invalid finance import' }, 400, session.pendingCookies);
  }
}

function json(body: unknown, status: number, pending: Parameters<typeof applyPendingCookies>[1] = []) {
  return applyPendingCookies(NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } }), pending);
}
