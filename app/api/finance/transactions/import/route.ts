import { createClient } from '@supabase/supabase-js';
import { financeImportStatus, handleMonarchImport, type ImportResult } from '../../../../../lib/finance/monarchImport';
import { readServerSupabaseConfig } from '../../../../../lib/supabaseRuntimeConfig';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/finance/transactions/import
 * Authorization: Bearer la_fin_<64 hex>
 * Body: { request_id, source: "monarch_mcp", transactions: [{ id, date, merchant, category, account_label, amount, pending? }] }
 * The token is hashed before it reaches the database. Amounts are not logged.
 */
export async function POST(request: Request) {
  return handleMonarchImport(request, {
    importRows: async (tokenHash, body) => {
      const config = await readServerSupabaseConfig();
      if (!config) return { ok: false, status: 503, error: 'Server not configured' };
      const db = createClient(config.url, config.key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await db.rpc('import_monarch_transactions', {
        p_token_hash: tokenHash,
        p_request_id: body.request_id,
        p_rows: body.transactions,
      });
      if (error) {
        console.error('finance import failed', error.code ?? 'unknown');
        const mapped = financeImportStatus(error.message, error.code);
        return { ok: false, status: mapped.status, error: mapped.error };
      }
      const result = data as ImportResult | null;
      if (!result || result.ok !== true || typeof result.request_id !== 'string') {
        return { ok: false, status: 500, error: 'Could not import transactions' };
      }
      return { ok: true, result };
    },
  });
}
