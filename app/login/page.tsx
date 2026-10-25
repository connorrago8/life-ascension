'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { emailAuthRedirect } from '../../lib/emailAuthRedirect';
import { safeNext } from '../../lib/safeNext';
import { supabase } from '../../lib/supabase';

function returnPath() {
  return safeNext(new URLSearchParams(window.location.search).get('next'), window.location.origin);
}

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [mode, setMode] = useState<'password' | 'link' | 'code'>('password');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void supabase().auth.getUser().then(({ data: { user } }) => {
      if (active && user) router.replace(returnPath());
    });
    const { data: { subscription } } = supabase().auth.onAuthStateChange((_event, session) => {
      if (active && session?.user) router.replace(returnPath());
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [router]);

  async function signInWithPassword(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage('');
    const { error } = await supabase().auth.signInWithPassword({ email: email.trim(), password });
    if (!error) {
      window.location.assign(returnPath());
      return;
    }
    if (error.status === 429 || /rate limit|too many requests/i.test(error.message)) {
      setMessage('Too many requests, wait a minute.');
    } else if (error.status === 400 || error.status === 401) {
      setMessage('Email or password is incorrect.');
    } else {
      setMessage('Could not sign in. Try again.');
    }
    setBusy(false);
  }

  async function requestCode(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage('');
    const { error } = await supabase().auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: false,
        emailRedirectTo: emailAuthRedirect(window.location.origin, returnPath()),
      },
    });
    if (error && (error.status === 429 || /rate limit|too many requests/i.test(error.message))) {
      setMessage('Too many requests, wait a minute.');
    } else {
      setMode('code');
      setMessage('If an account exists for this email, a 6-digit code was sent.');
    }
    setBusy(false);
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !/^\d{6}$/.test(code)) return;
    setBusy(true);
    setMessage('');
    const { error } = await supabase().auth.verifyOtp({ email: email.trim(), token: code, type: 'email' });
    if (error) setMessage('That code is invalid or expired. Request a new code and try again.');
    else router.replace(returnPath());
    setBusy(false);
  }

  return (
    <main className="wrap">
      <div className="eyebrow">LIFE ASCENSION</div>
      <h1>Sign in to your adventure</h1>
      {mode === 'password' && (
        <form className="panel auth-form" method="post" action="/login" onSubmit={signInWithPassword}>
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
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            className="field"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <button className="btn" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          <button className="btn ghost" type="button" disabled={busy} onClick={() => { setMode('link'); setMessage(''); }}>Email me a link instead</button>
          <p className="foot"><a href="/login/forgot">Forgot password?</a></p>
          <p id="login-status" role="status">{message}</p>
        </form>
      )}
      {mode === 'link' && (
        <form className="panel auth-form" method="post" action="/login" onSubmit={requestCode}>
          <p className="muted">We will email a sign-in link for this site. You can open the link or enter the 6-digit code.</p>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            className="field"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
          <button className="btn" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Email me a link instead'}</button>
          <button className="btn ghost" type="button" disabled={busy} onClick={() => { setMode('password'); setMessage(''); }}>Use password instead</button>
          <p id="login-status" role="status">{message}</p>
        </form>
      )}
      {mode === 'code' && (
        <form className="panel auth-form" method="post" action="/login" onSubmit={verify}>
          <p className="muted">Code sent to {email}. Enter the 6-digit code, or open the link in that email on this device.</p>
          <label htmlFor="otp">6-digit sign-in code</label>
          <input
            id="otp"
            name="one-time-code"
            className="field"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            pattern="[0-9]{6}"
            required
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
          />
          <button className="btn" type="submit" disabled={busy || code.length !== 6}>{busy ? 'Checking…' : 'Verify code and sign in'}</button>
          <button className="btn ghost" type="button" disabled={busy} onClick={() => { setMode('link'); setCode(''); setMessage(''); }}>Use a different email / resend code</button>
          <p id="login-status" role="status">{message}</p>
        </form>
      )}
    </main>
  );
}
