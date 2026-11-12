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

export function ActivityLog({ onLogged, onCancel }: { onLogged?: () => void; onCancel?: () => void }) {
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState('');
  const [date, setDate] = useState(companionGameDay);
  const [override, setOverride] = useState<XpTier | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const requestRef = useRef<{ payload: string; id: string } | null>(null);

  const previewText = duration.trim() ? `${title} ${duration.trim()} min` : title;
  const scored = useMemo(() => scoreActivity(previewText), [previewText]);
  const tier = override ?? scored.tier;
  const awardedTier = adjustTierForDuration(tier, previewText);
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
    const payload = `${title.trim()}|${duration.trim()}|${date}`;
    if (!requestRef.current || requestRef.current.payload !== payload) {
      requestRef.current = { payload, id: crypto.randomUUID() };
    }
    const { data, error } = await supabase().rpc('companion_log_activity_v2', {
      p_request: requestRef.current.id,
      p_title: title.trim(),
      p_note: duration.trim() ? `${duration.trim()} min` : null,
      p_tier: awardedTier,
      p_recorded_on: date || null,
    });
    setBusy(false);
    if (error) {
      setMessage("We couldn't confirm the save. Check History before trying again.");
      return;
    }
    const row = data as { already?: boolean; xpAwarded?: number } | null;
    const awarded = row?.xpAwarded ?? 0;
    setTitle('');
    setDuration('');
    setDate(companionGameDay());
    setOverride(null);
    requestRef.current = null;
    setMessage(row?.already ? 'Already logged for this game day.' : `This activity earned ${awarded} XP.`);
    onLogged?.();
  }

  function cycle() {
    setOverride(tier === 'small' ? 'medium' : tier === 'medium' ? 'big' : 'small');
  }

  function cancel() {
    if ((title.trim() || duration.trim()) && !window.confirm('Discard this activity?')) return;
    onCancel?.();
  }

  return (
    <form className="companion-card" onSubmit={(e) => void submit(e)}>
      <h2>What did you do?</h2>
      <label htmlFor="activity-title">Activity</label>
      <input
        id="activity-title"
        className="field"
        maxLength={120}
        placeholder="A walk, a meal, a tidy room — every effort counts."
        value={title}
        onChange={(e) => { setTitle(e.target.value); setOverride(null); }}
        required
      />
      <label htmlFor="activity-duration">Duration in minutes, optional</label>
      <input
        id="activity-duration"
        className="field"
        inputMode="numeric"
        maxLength={4}
        value={duration}
        onChange={(e) => { setDuration(e.target.value.replace(/[^\d]/g, '')); setOverride(null); }}
      />
      {title.trim() && (
        <p className="cq-score-chip" role="status">
          Estimated {xp} XP. {scored.example ? `Matches ${scored.example}.` : 'Unclear, so this stays at the lower tier.'}
          <button type="button" className="btn ghost" onClick={cycle}>
            Use {tier === 'small' ? 'medium' : tier === 'medium' ? 'big' : 'small'} instead
          </button>
        </p>
      )}
      <p className="muted">5 XP · {hints.small}</p>
      <p className="muted">10 XP · {hints.medium}</p>
      <p className="muted">20 XP · {hints.big}</p>
      <label htmlFor="activity-date">Game day, 5 AM Chicago</label>
      <input
        id="activity-date"
        className="field"
        type="date"
        value={date}
        min={minDate}
        max={maxDate}
        onChange={(e) => setDate(e.target.value)}
      />
      <div className="companion-actions">
        <button className="btn" type="submit" disabled={busy || !title.trim()}>Save activity</button>
        {onCancel && <button className="btn ghost" type="button" onClick={cancel}>Cancel</button>}
      </div>
      {message && <p className="message" role="status">{message}</p>}
    </form>
  );
}
