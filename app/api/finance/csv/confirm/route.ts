import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { maskAccountLabel, parseMonarchCsv } from '../../../../../lib/ascension/monarchCsv';
import { financeImportStatus, type ImportResult } from '../../../../../lib/finance/monarchImport';
import { applyPendingCookies, readSessionUser } from '../../../../../lib/supabaseServer';
import { readServerSupabaseConfig } from '../../../../../lib/supabaseRuntimeConfig';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Re-parses the CSV on the server, then stores owner rows. The response has counts, not amounts. */
export async function POST(request: NextRequest) {
  const session = await readSessionUser(request);
  if (!session.configured) return json({ error: 'Server not configured' }, 503, session.pendingCookies);
  if (!session.user) return json({ error: 'Sign-in required' }, 401, session.pendingCookies);
  const config = await readServerSupabaseConfig();
  if (!config) return json({ error: 'Server not configured' }, 503, session.pendingCookies);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid finance import' }, 400, session.pendingCookies);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return json({ error: 'Invalid finance import' }, 400, session.pendingCookies);
  }
  const record = body as { csv?: unknown; importId?: unknown };
  if (typeof record.csv !== 'string' || typeof record.importId !== 'string' || !UUID_PATTERN.test(record.importId)) {
    return json({ error: 'Invalid finance import' }, 400, session.pendingCookies);
  }
  let rows;
  try {
    rows = parseMonarchCsv(record.csv).rows.map((row) => ({
      date: row.date,
      merchant: row.merchant,
      category: row.category,
      account_label: maskAccountLabel(row.accountLabel),
      amount: row.amount,
    }));
  } catch {
    return json({ error: 'Invalid finance import' }, 400, session.pendingCookies);
  }

  const pending = [...session.pendingCookies];
  const client = createServerClient(config.url, config.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(items: { name: string; value: string; options: CookieOptions }[]) {
        pending.push(...items);
      },
    },
  });
  const { data, error } = await client.rpc('import_finance_csv', { p_import_id: record.importId, p_rows: rows });
  if (error) {
    console.error('finance csv import failed', error.code ?? 'unknown');
    const mapped = financeImportStatus(error.message, error.code);
    return json({ error: mapped.error }, mapped.status, pending);
  }
  const result = data as ImportResult | null;
  if (!result || result.ok !== true) return json({ error: 'Could not import transactions' }, 500, pending);
  return json({
    ok: true,
    replayed: result.replayed,
    request_id: result.request_id,
    inserted: result.inserted,
    updated: result.updated,
    unchanged: result.unchanged,
    verification: result.verification,
  }, 200, pending);
}

function json(body: unknown, status: number, pending: Parameters<typeof applyPendingCookies>[1] = []) {
  return applyPendingCookies(NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } }), pending);
}
