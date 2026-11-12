'use client';

import { useMemo, useRef, useState } from 'react';
import { examplesForTier } from '../../lib/activityGuide';
import { adjustTierForDuration, scoreActivity, xpForTier, type XpTier } from '../../lib/activityScorer';
import { companionGameDay } from '../../lib/companionGameDay';
import { supabase } from '../../lib/supabase';

function shiftDay(day: string, days: number): string {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, date + days)).toISOString().slice(0, 10);
}

export function ActivityLog({ onLogged }: { onLogged?: () => void }) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [override, setOverride] = useState<XpTier | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const requestRef = useRef<{ payload: string; id: string } | null>(null);

  const scored = useMemo(() => scoreActivity(title), [title]);
  const tier = override ?? scored.tier;
  const awardedTier = adjustTierForDuration(tier, title);
  const xp = xpForTier(awardedTier);
  const hints = {
    small: examplesForTier('small').slice(0, 3).map((example) => example.title).join(' · '),
    medium: examplesForTier('medium').slice(0, 3).map((example) => example.title).join(' · '),
    big: examplesForTier('big').slice(0, 3).map((example) => example.title).join(' · '),
  };

  const maxDate = companionGameDay();
  const minDate = shiftDay(maxDate, -30);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    setMessage('');
    const payload = `${title.trim()}|${date}`;
    if (!requestRef.current || requestRef.current.payload !== payload) {
      requestRef.current = { payload, id: crypto.randomUUID() };
    }
    const { data, error } = await supabase().rpc('companion_log_activity_v2', {
      p_request: requestRef.current.id,
      p_title: title.trim(),
      p_note: null,
      p_tier: awardedTier,
      p_recorded_on: date || null,
    });
    setBusy(false);
    if (error) {
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
      const network = /fetch|network/i.test(error.message);
      setMessage(offline || network
        ? "This activity wasn't saved. Reconnect and try again."
        : error.message);
      return;
    }
    const row = data as { already?: boolean; xpAwarded?: number } | null;
    setTitle('');
    setDate('');
    setOverride(null);
    requestRef.current = null;
    setMessage(row?.already ? 'Already logged for this game day.' : `Logged. +${row?.xpAwarded ?? xp} XP`);
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
        placeholder="e.g. Make the bed, Cook dinner, Deep-clean bathroom"
        value={title}
        onChange={(e) => { setTitle(e.target.value); setOverride(null); }}
        required
      />
      {title.trim() && (
        <p className="cq-score-chip" role="status">
          {scored.example ? `Matches ${scored.example}` : 'Unclear, so this stays at the lower tier'} · {awardedTier} ({xp} XP)
          <button type="button" className="btn ghost" onClick={cycle}>
            Use {tier === 'small' ? 'medium' : tier === 'medium' ? 'big' : 'small'} instead
          </button>
        </p>
      )}
      <p className="muted">5 XP · {hints.small}</p>
      <p className="muted">10 XP · {hints.medium}</p>
      <p className="muted">20 XP · {hints.big}</p>
      <label htmlFor="activity-date">Game day (starts 5 AM Chicago, up to 30 days back)</label>
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
