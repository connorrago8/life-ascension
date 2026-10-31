'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../../lib/supabase';

type ApiKeyRow = {
  id: string;
  name: string;
  prefix: string;
  scopes: string[] | null;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

export default function ApiKeysPage() {
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [name, setName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const client = supabase();
      const { data: authData, error: authError } = await client.auth.getUser();
      const user = authError ? null : authData.user;
      setUserId(user?.id ?? null);
      setReady(true);
      if (!user) {
        setKeys([]);
        return;
      }
      const { data, error } = await client
        .from('api_keys_safe')
        .select('id,name,prefix,scopes,created_at,last_used_at,revoked_at')
        .order('created_at', { ascending: false });
      if (error) {
        setMessage(error.message);
        return;
      }
      setKeys((data ?? []) as ApiKeyRow[]);
    } catch {
      setMessage('Supabase is not configured in this browser.');
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void load();
    try {
      const { data: { subscription } } = supabase().auth.onAuthStateChange(() => { void load(); });
      return () => subscription.unsubscribe();
    } catch {
      return;
    }
  }, [load]);

  async function createKey(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !name.trim()) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      const payload = await response.json().catch(() => null) as { error?: unknown; api_key?: unknown } | null;
      if (!response.ok || typeof payload?.api_key !== 'string') {
        setMessage(typeof payload?.error === 'string' ? payload.error : 'Unable to create an API key.');
        setBusy(false);
        return;
      }
      setCreatedKey(payload.api_key);
      setName('');
      setMessage('New key created. Copy it now. It will not be shown again.');
      await load();
    } catch {
      setMessage('Unable to create an API key.');
    }
    setBusy(false);
  }

  async function copyKey() {
    if (!createdKey) return;
    try {
      await navigator.clipboard.writeText(createdKey);
      setMessage('Copied. Store the key somewhere safe, then dismiss it.');
    } catch {
      setMessage('Clipboard unavailable. Select the key and copy it manually.');
    }
  }

  async function revoke(id: string) {
    if (busy) return;
    if (!window.confirm('Revoke this API key? Clients using it will stop working.')) return;
    setBusy(true);
    const { error } = await supabase().rpc('revoke_api_key', { p_key_id: id });
    setMessage(error?.message || 'API key revoked.');
    if (createdKey) setCreatedKey(null);
    await load();
    setBusy(false);
  }

  if (!ready) return <main className="wrap">Loading API keys…</main>;
  if (!userId) {
    return (
      <main className="wrap">
        <div className="eyebrow">LIFE ASCENSION</div>
        <h1>API keys</h1>
        <p className="muted">Sign in to create a personal key for AI tools.</p>
        <a className="btn" href="/login?next=%2Fsettings%2Fapi-keys">Sign in</a>
      </main>
    );
  }

  return (
    <main className="wrap">
      <header className="top">
        <div>
          <div className="eyebrow">LIFE ASCENSION</div>
          <h1>API keys</h1>
          <p className="muted">Signed in as your private account.</p>
        </div>
        <a className="btn ghost" href="/quests">Quest board</a>
      </header>

      <section className="panel">
        <p className="muted">
          Keys use the form <code>la_live_…</code>. The full key is shown once.
          The server stores only a SHA-256 hash, plus this prefix so you can recognize the key later.
        </p>
        {createdKey && (
          <div className="warn" role="alert">
            <strong>Copy this key now.</strong>
            <p>This is the only time it will be shown. A revoked key stops working immediately.</p>
            <input className="field keybox" readOnly value={createdKey} aria-label="New API key" />
            <div className="actions">
              <button className="btn" type="button" onClick={() => { void copyKey(); }}>Copy</button>
              <button className="btn ghost" type="button" onClick={() => setCreatedKey(null)}>I have saved this key</button>
            </div>
          </div>
        )}
        <form onSubmit={createKey}>
          <label htmlFor="key-name">Key name</label>
          <input
            id="key-name"
            className="field"
            maxLength={80}
            required
            placeholder="e.g. Laptop ChatGPT"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <button className="btn" disabled={busy || !name.trim()}>Create API key</button>
        </form>
      </section>

      <section className="panel">
        <h2>Your keys</h2>
        {keys.length === 0 && <p className="muted">No keys yet.</p>}
        {keys.map((key) => (
          <div className="quest" key={key.id}>
            <div className="quest-main">
              <div className="quest-title">{key.name}</div>
              <div className="muted">
                {key.prefix}… · Created {formatWhen(key.created_at)} · Last used {key.last_used_at ? formatWhen(key.last_used_at) : 'never'}
                {key.scopes?.length ? ` · ${key.scopes.join(', ')}` : ''}
              </div>
            </div>
            <div className="actions">
              {key.revoked_at
                ? <span className="tag">Revoked</span>
                : <button className="btn ghost" type="button" disabled={busy} onClick={() => { void revoke(key.id); }}>Revoke</button>}
            </div>
          </div>
        ))}
      </section>
      <p className="message" role="status" aria-live="polite">{message}</p>
      <p className="foot"><a href="/quests">Quest notes</a> · <a href="/settings/password">Set or change password</a></p>
    </main>
  );
}

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}
