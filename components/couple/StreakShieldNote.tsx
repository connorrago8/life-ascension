'use client';

import { useEffect, useRef, useState } from 'react';
import '../../app/couple.css';
import { shieldLabel } from '../../lib/streakShield';
import { supabase } from '../../lib/supabase';

type ShieldResponse = {
  status?: unknown;
  notice?: unknown;
  doneToday?: unknown;
  eligibleMissedDay?: unknown;
};

function eligibleDay(value: unknown): string | null {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

/** Read-only status plus a separate, explicitly confirmed monthly shield spend. */
export function StreakShieldNote() {
  const [notice, setNotice] = useState<string | null>(null);
  const [candidate, setCandidate] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requiresRefresh, setRequiresRefresh] = useState(false);
  const inFlight = useRef(false);

  useEffect(() => {
    const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    if (process.env.NODE_ENV === 'development' && params?.get('preview') === '1') {
      setNotice(shieldLabel(params.get('shield') === 'used' ? 'used' : 'ready', { doneToday: false }));
      return;
    }
    let active = true;
    void (async () => {
      try {
        const { data, error: readError } = await supabase().rpc('get_streak_shield');
        if (!active || readError || !data || typeof data !== 'object') return;
        const row = data as ShieldResponse;
        if (typeof row.notice === 'string' && row.notice.startsWith('Streak Shield')) {
          setNotice(row.notice);
        } else if (row.status === 'ready' || row.status === 'used') {
          setNotice(shieldLabel(row.status, { doneToday: row.doneToday === true }));
        }
        if (row.status === 'ready') setCandidate(eligibleDay(row.eligibleMissedDay));
      } catch { /* Database unavailable: do not offer a speculative spend. */ }
    })();
    return () => { active = false; };
  }, []);

  async function confirmSpend() {
    if (!candidate || !confirming || requiresRefresh || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const { data, error: writeError } = await supabase().rpc('confirm_streak_shield', { p_missed_day: candidate });
      if (writeError || !data || typeof data !== 'object' || (data as ShieldResponse).status !== 'used') {
        setRequiresRefresh(true);
        setError('Could not confirm your shield. Nothing was changed on this screen. Please refresh before trying again.');
        return;
      }
      const row = data as ShieldResponse;
      setNotice(typeof row.notice === 'string' ? row.notice : shieldLabel('used'));
      setCandidate(null);
      setConfirming(false);
    } catch {
      setRequiresRefresh(true);
      setError('Connection interrupted. Refresh to check whether your shield was used before trying again.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  if (!notice) return null;
  return (
    <section className="streak-shield" aria-label="Monthly Streak Shield">
      <p role="status">{notice}</p>
      {candidate && !confirming && (
        <button type="button" className="btn ghost" onClick={() => setConfirming(true)}>
          Review Streak Shield
        </button>
      )}
      {candidate && confirming && (
        <div>
          <p>Use this month's Streak Shield to protect the missed game day {candidate}? This spends your one shield for that month. No XP is awarded.</p>
          <button type="button" className="btn" disabled={busy || requiresRefresh} onClick={() => { void confirmSpend(); }}>
            {busy ? 'Confirming…' : 'Use Shield'}
          </button>
          <button type="button" className="btn ghost" disabled={busy || requiresRefresh} onClick={() => setConfirming(false)}>
            Not Now
          </button>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
