import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { IzzyIntakeStore } from './intake';

/**
 * Trusted backend only. The service-role key must never be exposed through
 * NEXT_PUBLIC_ variables, rendered responses, logs, or browser bundles.
 * Database RPC handles the entire insert in one transaction.
 */
export function createIzzyIntakeStore(): IzzyIntakeStore {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error('Izzy intake server configuration is missing');
  }

  const client = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return {
    async insertOnce({ submissionId, headers, cells, proposals }) {
      const { data, error } = await client.rpc('stage_izzy_submission', {
        p_submission_id: submissionId,
        p_headers: headers,
        p_cells: cells,
        p_proposals: proposals,
      });
      if (error) {
        // Do not include payload, database error detail, or secrets in logs.
        throw new Error('Izzy intake transaction failed');
      }
      if (typeof data !== 'boolean') {
        throw new Error('Izzy intake returned an unexpected result');
      }
      return data;
    },
  };
}
