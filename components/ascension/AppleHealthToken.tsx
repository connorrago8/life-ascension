'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

type TokenRow = {
  id: string;
  token_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

export function AppleHealthToken() {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [rows, setRows] = useState<TokenRow[]>([]);
  const [plaintext, setPlaintext] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const client = supabase();
      const { data: authData } = await client.auth.getUser();
      setSignedIn(Boolean(authData.user));
      setReady(true);
      if (!authData.user) {
        setRows([]);
        return;
      }
      const { data, error } = await client
        .from('health_ingest_tokens_safe')
        .select('id,token_prefix,created_at,last_used_at,revoked_at')
        .order('created_at', { ascending: false });
      if (error) {
        setMessage('The token list could not load.');
        return;
      }
      setRows((data ?? []) as TokenRow[]);
    } catch {
      setMessage('Supabase is not configured in this browser.');
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const active = rows.find((row) => !row.revoked_at) ?? null;

  async function issue(rotate: boolean) {
    if (busy) return;
    if (rotate && !window.confirm('Rotate the Apple Health token? The shortcut keeps working only after you paste the new one.')) return;
    setBusy(true);
    setMessage('');
    const { data, error } = await supabase().rpc('issue_health_ingest_token', { p_rotate: rotate });
    if (error || !data || typeof data !== 'object' || typeof (data as { token?: unknown }).token !== 'string') {
      setMessage(error?.message || 'Could not create a token.');
      setBusy(false);
      return;
    }
    setPlaintext((data as { token: string }).token);
    setMessage('Copy this token now. It will not be shown again.');
    await load();
    setBusy(false);
  }

  async function revoke() {
    if (busy || !active) return;
    if (!window.confirm('Revoke the Apple Health token? The shortcut will stop until you create a new one.')) return;
    setBusy(true);
    const { error } = await supabase().rpc('revoke_health_ingest_token');
    setPlaintext(null);
    setMessage(error?.message || 'Token revoked.');
    await load();
    setBusy(false);
  }

  async function copyToken() {
    if (!plaintext) return;
    try {
      await navigator.clipboard.writeText(plaintext);
      setMessage('Copied. Store it in the shortcut, then dismiss it here.');
    } catch {
      setMessage('Clipboard unavailable. Select the token and copy it.');
    }
  }

  if (!ready) return <p>Loading Apple Health token…</p>;
  if (!signedIn) {
    return <p><a className="btn" href="/login?next=%2Fsettings%2Fapple-health">Sign in</a></p>;
  }

  return (
    <section className="panel" aria-label="Apple Health token">
      <h2>1. Your ingest token</h2>
      <p className="muted">One token for your account. The server stores only a SHA-256 hash. The full token is shown once.</p>
      {plaintext && (
        <div className="warn" role="alert">
          <strong>Copy this token now.</strong>
          <p>This is the only time it will be shown. It starts with <code>la_sleep_</code>.</p>
          <input className="field keybox" readOnly value={plaintext} aria-label="New Apple Health token" />
          <div className="actions">
            <button className="btn" type="button" onClick={() => { void copyToken(); }}>Copy</button>
            <button className="btn ghost" type="button" onClick={() => setPlaintext(null)}>I have saved this token</button>
          </div>
        </div>
      )}
      {active ? (
        <>
          <p>{active.token_prefix}… · Created {formatWhen(active.created_at)} · Last used {active.last_used_at ? formatWhen(active.last_used_at) : 'never'}</p>
          <div className="actions">
            <button className="btn" type="button" disabled={busy} onClick={() => { void issue(true); }}>Rotate</button>
            <button className="btn ghost" type="button" disabled={busy} onClick={() => { void revoke(); }}>Revoke</button>
          </div>
        </>
      ) : (
        <button className="btn" type="button" disabled={busy} onClick={() => { void issue(false); }}>Generate token</button>
      )}
      <p className="message" role="status">{message}</p>
    </section>
  );
}

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}
