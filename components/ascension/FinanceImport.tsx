'use client';

import { useCallback, useEffect, useState } from 'react';
import { useCompanionRole } from '../useCompanionRole';
import type { SessionRole } from '../../lib/companionAccess';
import { financeImportVisible } from '../../lib/ascension/financeAccess';
import { supabase } from '../../lib/supabase';

type Preview = { rowCount: number; dateStart: string; dateEnd: string; csv: string; importId: string };
type Summary = {
  owner?: boolean;
  week_start?: string;
  week_end?: string;
  row_count?: number;
  categories?: { category: string; spent: string }[];
  merchants?: { merchant: string; spent: string }[];
  checks?: Record<string, { status?: string }>;
};
type TokenRow = { id: string; token_prefix: string; revoked_at: string | null };

const CHECK_LABEL: Record<string, string> = {
  payment_posted: 'Confirm a Payment Posted',
  week_spending: "Review This Week's Spending",
  no_spend_day: 'No-Spend Day',
};

export function FinanceImport({ role }: { role?: SessionRole }) {
  const detected = useCompanionRole(role === undefined);
  const mode = role ?? detected.mode;
  const ready = role !== undefined || detected.status === 'ready';
  const [preview, setPreview] = useState<Preview | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [freshToken, setFreshToken] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const client = supabase();
    const [summaryResult, tokenResult] = await Promise.all([
      client.rpc('finance_week_summary'),
      client.from('finance_ingest_tokens_safe').select('id,token_prefix,revoked_at').order('created_at', { ascending: false }).limit(5),
    ]);
    if (!summaryResult.error && summaryResult.data && typeof summaryResult.data === 'object') {
      setSummary(summaryResult.data as Summary);
    }
    if (!tokenResult.error) setTokens((tokenResult.data ?? []) as TokenRow[]);
  }, []);

  useEffect(() => {
    if (!ready || mode !== 'adventurer') return;
    void load();
  }, [ready, mode, load]);

  if (!ready || !financeImportVisible(mode)) return null;

  async function onFile(file: File | undefined) {
    if (!file || busy) return;
    setBusy(true);
    setMessage('');
    setFreshToken('');
    try {
      const csv = await file.text();
      const response = await fetch('/api/finance/csv/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv }),
      });
      const payload = await response.json() as { rowCount?: number; dateStart?: string; dateEnd?: string; error?: string };
      if (!response.ok || typeof payload.rowCount !== 'number' || !payload.dateStart || !payload.dateEnd) {
        setPreview(null);
        setMessage(payload.error || 'That file could not be read.');
        return;
      }
      setPreview({ rowCount: payload.rowCount, dateStart: payload.dateStart, dateEnd: payload.dateEnd, csv, importId: crypto.randomUUID() });
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!preview || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/finance/csv/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: preview.csv, importId: preview.importId }),
      });
      const payload = await response.json() as { error?: string; inserted?: number; unchanged?: number };
      if (!response.ok) {
        setMessage(payload.error || 'Import did not save.');
        return;
      }
      setMessage(`Imported. ${payload.inserted ?? 0} new, ${payload.unchanged ?? 0} already saved.`);
      setPreview(null);
      window.dispatchEvent(new Event('finance-verified'));
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function tokenAction(action: 'create' | 'rotate' | 'revoke') {
    if (busy) return;
    setBusy(true);
    setMessage('');
    setFreshToken('');
    const rpc = action === 'create' ? 'finance_ingest_token_create' : action === 'rotate' ? 'finance_ingest_token_rotate' : 'finance_ingest_token_revoke';
    try {
      const { data, error } = await supabase().rpc(rpc);
      if (error) { setMessage(error.message); return; }
      const payload = data as { token?: string };
      if (typeof payload?.token === 'string') setFreshToken(payload.token);
      else setMessage(action === 'revoke' ? 'Token revoked.' : 'Token updated.');
      await load();
    } finally {
      setBusy(false);
    }
  }

  const active = tokens.some((token) => !token.revoked_at);
  const reviews = Object.entries(summary?.checks ?? {}).filter(([, check]) => check?.status === 'needs_review');

  return (
    <section className="ascension-track" aria-label="Finance import">
      <h2>Import</h2>
      <p className="muted">Upload a Monarch transactions CSV, or send a daily pull to the owner import endpoint. Amounts stay on this page.</p>
      <label>Monarch CSV
        <input className="field" type="file" accept=".csv,text/csv" disabled={busy} onChange={(event) => { void onFile(event.target.files?.[0]); }} />
      </label>
      {preview && (
        <div>
          <p>{preview.rowCount} rows from {preview.dateStart} through {preview.dateEnd}.</p>
          <button type="button" className="btn" disabled={busy} onClick={() => { void confirm(); }}>Confirm import</button>
        </div>
      )}
      <h2>This week</h2>
      {summary?.owner && (
        <>
          <p className="muted">{summary.week_start} through {summary.week_end}. {summary.row_count ?? 0} posted rows.</p>
          <ul className="ascension-summary">
            {(summary.categories ?? []).map((row) => <li key={row.category}><span>{row.category}</span><span>${row.spent}</span></li>)}
          </ul>
          <p className="muted">Top merchants</p>
          <ul className="ascension-summary">
            {(summary.merchants ?? []).map((row) => <li key={row.merchant}><span>{row.merchant}</span><span>${row.spent}</span></li>)}
          </ul>
        </>
      )}
      {reviews.map(([id]) => <p key={id} data-review="needs-review">{CHECK_LABEL[id] ?? id}: Needs review</p>)}
      <h2>Import token</h2>
      <p className="muted">Shown once. The daily pull sends it as a Bearer token. Rotate replaces it.</p>
      {freshToken && <p className="ascension-token" role="status">{freshToken}</p>}
      <button type="button" className="btn" disabled={busy || active} onClick={() => { void tokenAction('create'); }}>Create token</button>
      <button type="button" className="btn ghost" disabled={busy || !active} onClick={() => { void tokenAction('rotate'); }}>Rotate token</button>
      <button type="button" className="btn ghost" disabled={busy || !active} onClick={() => { void tokenAction('revoke'); }}>Revoke token</button>
      {message && <p className="message" role="status">{message}</p>}
    </section>
  );
}
