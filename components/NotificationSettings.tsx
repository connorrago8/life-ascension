'use client';

import { useCallback, useEffect, useState } from 'react';
import { urlBase64ToUint8Array } from '../lib/push/browserKey';
import { DEFAULT_QUIET_END, DEFAULT_QUIET_START, parseClock } from '../lib/push/quietHours';
import { supabase } from '../lib/supabase';

type Prefs = {
  partner_assigned: boolean;
  partner_completed: boolean;
  streak_at_risk: boolean;
  daily_progress: boolean;
  quiet_start: string;
  quiet_end: string;
};

type TokenRow = {
  id: string;
  token_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

const DEFAULTS: Prefs = {
  partner_assigned: true,
  partner_completed: true,
  streak_at_risk: true,
  daily_progress: true,
  quiet_start: DEFAULT_QUIET_START,
  quiet_end: DEFAULT_QUIET_END,
};

const TOGGLES: { key: keyof Pick<Prefs, 'partner_assigned' | 'partner_completed' | 'streak_at_risk' | 'daily_progress'>; label: string }[] = [
  { key: 'partner_assigned', label: 'Partner assigned you a quest' },
  { key: 'partner_completed', label: 'Partner completed a quest you assigned' },
  { key: 'streak_at_risk', label: 'Evening reminder if your streak is at risk' },
  { key: 'daily_progress', label: 'Daily progress (one updating notification)' },
];

function clock(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const short = value.slice(0, 5);
  return parseClock(short) === null ? fallback : short;
}

export function NotificationSettings() {
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [freshToken, setFreshToken] = useState<string | null>(null);
  const [cronBound, setCronBound] = useState<boolean | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const config = await fetch('/api/push/config').then((response) => response.json()).catch(() => null);
      setConfigured(Boolean(config?.configured));
      setPublicKey(typeof config?.publicKey === 'string' ? config.publicKey : null);
      const client = supabase();
      const { data: authData, error: authError } = await client.auth.getUser();
      const user = authError ? null : authData.user;
      setUserId(user?.id ?? null);
      setReady(true);
      if (!user) return;
      const [prefResult, tokenResult, cronResult] = await Promise.all([
        client.from('notification_preferences').select('partner_assigned,partner_completed,streak_at_risk,daily_progress,quiet_start,quiet_end').eq('user_id', user.id).maybeSingle(),
        client.from('widget_tokens_safe').select('id,token_prefix,created_at,last_used_at,revoked_at').order('created_at', { ascending: false }),
        client.rpc('engagement_cron_bound'),
      ]);
      if (!prefResult.error && prefResult.data) {
        const row = prefResult.data as Partial<Prefs>;
        setPrefs({
          partner_assigned: row.partner_assigned !== false,
          partner_completed: row.partner_completed !== false,
          streak_at_risk: row.streak_at_risk !== false,
          daily_progress: row.daily_progress !== false,
          quiet_start: clock(row.quiet_start, DEFAULT_QUIET_START),
          quiet_end: clock(row.quiet_end, DEFAULT_QUIET_END),
        });
      }
      if (!tokenResult.error && Array.isArray(tokenResult.data)) setTokens(tokenResult.data as TokenRow[]);
      if (!cronResult.error) setCronBound(cronResult.data === true);
    } catch {
      setReady(true);
      setMessage('Notifications could not be loaded.');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function save(next: Prefs) {
    if (!userId) return;
    setPrefs(next);
    setBusy(true);
    setMessage('');
    const { error } = await supabase().from('notification_preferences').upsert({
      user_id: userId,
      ...next,
      updated_at: new Date().toISOString(),
    });
    setBusy(false);
    setMessage(error ? 'Could not save notification settings.' : 'Saved.');
  }

  async function enablePush() {
    if (!publicKey || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setMessage('This browser cannot subscribe to web push.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setMessage('Notification permission was not granted.');
        return;
      }
      const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
      const ready = await navigator.serviceWorker.ready;
      const subscription = await (registration.pushManager || ready.pushManager).subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const json = subscription.toJSON();
      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || body?.configured === false) {
        setMessage(body?.configured === false ? 'Push is not configured on this server.' : 'Could not save this device.');
        return;
      }
      await fetch('/api/push/flush', { method: 'POST' });
      setMessage('This device will get your notifications.');
    } catch (error) {
      const detail = error instanceof Error ? error.message : '';
      setMessage(detail ? `Could not enable notifications on this device. ${detail}` : 'Could not enable notifications on this device.');
    } finally {
      setBusy(false);
    }
  }

  async function disablePush() {
    if (!('serviceWorker' in navigator)) return;
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration('/');
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setMessage('This device is unsubscribed.');
    } catch {
      setMessage('Could not unsubscribe this device.');
    } finally {
      setBusy(false);
    }
  }

  async function createToken() {
    setBusy(true);
    setMessage('');
    const { data, error } = await supabase().rpc('widget_create_token');
    setBusy(false);
    const row = data as { ok?: boolean; token?: string } | null;
    if (error || !row?.token) {
      setMessage(error?.message === 'Revoke an unused widget token first' ? error.message : 'Could not create a widget token.');
      return;
    }
    setFreshToken(row.token);
    await load();
  }

  async function revokeToken(id: string) {
    setBusy(true);
    await supabase().rpc('widget_revoke_token', { p_id: id });
    setBusy(false);
    await load();
  }

  if (!ready) return <p className="muted">Loading…</p>;
  if (!userId) return <p>Sign in to choose notifications. <a href="/login?next=%2Fsettings%2Fnotifications">Sign in</a></p>;

  return (
    <div>
      {configured === false && (
        <p className="message engage-note" role="status">Push is not configured on this server.</p>
      )}
      <section className="panel" aria-label="Notification types">
        <h2>What to send</h2>
        <p className="muted">Each account is separate. These never include your partner's XP, level, or streak.</p>
        {TOGGLES.map((toggle) => (
          <label className="engage-toggle" key={toggle.key}>
            <span>{toggle.label}</span>
            <input
              type="checkbox"
              checked={prefs[toggle.key]}
              disabled={busy}
              onChange={(event) => { void save({ ...prefs, [toggle.key]: event.target.checked }); }}
            />
          </label>
        ))}
        <div className="form-row">
          <label>Quiet from
            <input className="field" type="time" value={prefs.quiet_start} disabled={busy} onChange={(event) => {
              if (parseClock(event.target.value) === null) return;
              void save({ ...prefs, quiet_start: event.target.value });
            }} />
          </label>
          <label>Until
            <input className="field" type="time" value={prefs.quiet_end} disabled={busy} onChange={(event) => {
              if (parseClock(event.target.value) === null) return;
              void save({ ...prefs, quiet_end: event.target.value });
            }} />
          </label>
        </div>
        <p className="muted">Default is 10:00 PM to 7:00 AM America/Chicago. Set both times the same to turn quiet hours off. The streak reminder only sends between 7 and 10 PM.</p>
        {cronBound === false && <p className="muted">Scheduled reminders also need the cron secret bound on TEST. Until then, the reminder sends only if this app is open in the evening.</p>}
      </section>

      <section className="panel" aria-label="This device">
        <h2>This device</h2>
        <div className="actions">
          <button type="button" className="btn" disabled={busy || configured === false} onClick={() => { void enablePush(); }}>Enable notifications</button>
          <button type="button" className="btn ghost" disabled={busy} onClick={() => { void disablePush(); }}>Unsubscribe</button>
        </div>
      </section>

      <section className="panel" aria-label="Scriptable widget">
        <h2>iPhone widget</h2>
        <p className="muted">A read-only token for the free Scriptable widget. It shows only your quests, streak, and XP. Revoke it here any time. The token is shown once.</p>
        <button type="button" className="btn ghost" disabled={busy} onClick={() => { void createToken(); }}>Create widget token</button>
        {freshToken && <p className="engage-token" role="status">{freshToken}</p>}
        <ul>
          {tokens.filter((token) => !token.revoked_at).map((token) => (
            <li key={token.id} className="engage-toggle">
              <span>{token.token_prefix}…</span>
              <button type="button" className="btn ghost" disabled={busy} onClick={() => { void revokeToken(token.id); }}>Revoke</button>
            </li>
          ))}
        </ul>
      </section>
      {message && <p className="message" role="status">{message}</p>}
    </div>
  );
}
