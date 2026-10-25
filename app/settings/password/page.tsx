'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';

export default function SetPassword() {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    let subscription: { unsubscribe(): void } | undefined;
    try {
      const client = supabase();
      const timer = window.setTimeout(() => {
        if (active) setReady(true);
      }, 8000);
      void client.auth.getUser().then(({ data: { user } }) => {
        if (!active) return;
        setSignedIn(Boolean(user));
        setEmail(user?.email ?? '');
        setReady(true);
      }).catch(() => {
        if (active) setReady(true);
      }).finally(() => window.clearTimeout(timer));
      subscription = client.auth.onAuthStateChange((_event, session) => {
        if (!active) return;
        setSignedIn(Boolean(session?.user));
        setEmail(session?.user?.email ?? '');
        setReady(true);
      }).data.subscription;
    } catch {
      if (active) {
        setMessage('Supabase is not configured in this browser.');
        setReady(true);
      }
    }
    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setOk(false);
    if (password.length < 8) {
      setMessage('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setMessage('Passwords do not match.');
      return;
    }
    if (!signedIn) {
      setMessage('Sign in first, or open the reset link from your email. Then save the password here.');
      return;
    }
    setBusy(true);
    setMessage('');
    const { error } = await supabase().auth.updateUser({ password });
    if (!error) {
      setPassword('');
      setConfirm('');
      setOk(true);
      setMessage('Password saved. You can sign in with your email and this password next time.');
    } else if (error.status === 429 || /rate limit|too many requests/i.test(error.message)) {
      setMessage('Too many requests, wait a minute.');
    } else if (/different/i.test(error.message)) {
      setMessage('Choose a password that is different from the current one.');
    } else {
      setMessage('Could not save the password. Try again.');
    }
    setBusy(false);
  }

  return (
    <main className="wrap">
      <div className="eyebrow">LIFE ASCENSION</div>
      <h1>Set or change password</h1>
      {ready && !signedIn && (
        <section className="panel">
          <p className="muted">Sign in once with your email link, then save a password here. A reset link from your email also returns to this page.</p>
          <a className="btn" href="/login?next=%2Fsettings%2Fpassword">Sign in</a>
        </section>
      )}
      <form className="panel auth-form" method="post" action="/settings/password" noValidate onSubmit={save}>
        <p className="muted">Choose a password for this account. Your browser can save it and fill it in next time.</p>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          className="field"
          type="email"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
        />
        <label htmlFor="password">New password</label>
        <input
          id="password"
          name="password"
          className="field"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <label htmlFor="confirm-password">Confirm password</label>
        <input
          id="confirm-password"
          name="confirm-password"
          className="field"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
        />
        <button className="btn" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save password'}</button>
        <p id="password-status" role="status" className={ok ? 'ok' : message ? 'warn' : 'message'}>{message}</p>
      </form>
      <p className="foot"><a href="/">Quest board</a> · <a href="/quests">Quest notes</a> · <a href="/settings/api-keys">API keys</a></p>
    </main>
  );
}
