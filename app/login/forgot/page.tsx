'use client';

import { useState } from 'react';
import { emailAuthRedirect } from '../../../lib/emailAuthRedirect';
import { supabase } from '../../../lib/supabase';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage('');
    const { error } = await supabase().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: emailAuthRedirect(window.location.origin, '/settings/password'),
    });
    if (error && (error.status === 429 || /rate limit|too many requests/i.test(error.message))) {
      setMessage('Too many requests, wait a minute.');
    } else {
      setMessage('If an account exists for this email, a password reset link was sent.');
    }
    setBusy(false);
  }

  return (
    <main className="wrap">
      <div className="eyebrow">LIFE ASCENSION</div>
      <h1>Forgot password</h1>
      <form className="panel auth-form" method="post" action="/login/forgot" onSubmit={send}>
        <p className="muted">We will email a link that opens the set-password page on this site.</p>
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
        <button className="btn" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Email reset link'}</button>
        <p id="forgot-status" role="status">{message}</p>
      </form>
      <p className="foot"><a href="/login">Back to sign in</a></p>
    </main>
  );
}
