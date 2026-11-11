'use client';

import { useMemo, useState } from 'react';
import { scoreActivity, type XpTier } from '../../lib/activityScorer';
import { supabase } from '../../lib/supabase';

export function ActivityLog({ onLogged }: { onLogged?: () => void }) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [override, setOverride] = useState<XpTier | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const scored = useMemo(() => scoreActivity(title), [title]);
  const tier = override ?? scored.tier;
  const xp = tier === 'small' ? 5 : tier === 'medium' ? 10 : 20;

  const maxDate = new Date().toISOString().slice(0, 10);
  const minDate = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    setMessage('');
    const requestId = crypto.randomUUID();
    const { error } = await supabase().rpc('companion_log_activity_v2', {
      p_request: requestId,
      p_title: title.trim(),
      p_note: null,
      p_tier: tier,
      p_recorded_on: date || null,
    });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setTitle('');
    setDate('');
    setOverride(null);
    setMessage(`Logged. +${xp} XP`);
    onLogged?.();
  }

  function cycle() {
    setOverride(tier === 'small' ? 'medium' : tier === 'medium' ? 'big' : 'small');
  }

  return (
    <form className="companion-card" onSubmit={(e) => void submit(e)}>
      <h2>Log activity</h2>
      <label htmlFor="activity-title">What did she do?</label>
      <input
        id="activity-title"
        className="field"
        maxLength={120}
        placeholder="e.g. deep cleaned the bathroom, yoga 1hr"
        value={title}
        onChange={(e) => { setTitle(e.target.value); setOverride(null); }}
        required
      />
      {title.trim() && (
        <p className="cq-score-chip" role="status">
          Suggested: {scored.category} · {scored.tier} ({scored.xp} XP)
          <button type="button" className="btn ghost" onClick={cycle}>
            Use {tier === 'small' ? 'medium' : tier === 'medium' ? 'big' : 'small'} instead
          </button>
        </p>
      )}
      <label htmlFor="activity-date">Backdate (optional, up to 30 days)</label>
      <input
        id="activity-date"
        className="field"
        type="date"
        value={date}
        min={minDate}
        max={maxDate}
        onChange={(e) => setDate(e.target.value)}
      />
      <button className="btn" type="submit" disabled={busy || !title.trim()}>
        Award {xp} XP
      </button>
      {message && <p className="message" role="status">{message}</p>}
    </form>
  );
}
