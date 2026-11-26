'use client';

import { useEffect, useRef, useState } from 'react';
import { SCHEDULE_QUEST_LABEL, parseQuestPrefill, type QuestPrefill } from '../../lib/ascension/prefill';
import { gameDayParts } from '../../lib/questStreak';
import { supabase } from '../../lib/supabase';

/** Prefill from /?quest= and /quests?quest=. Scheduling creates a quest and awards no XP. */
export function QuestScheduleBanner() {
  const [prefill, setPrefill] = useState<QuestPrefill | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const inFlight = useRef(false);

  useEffect(() => {
    const today = gameDayParts(new Date()).date;
    setPrefill(parseQuestPrefill(new URLSearchParams(window.location.search), today));
  }, []);

  if (!prefill && !message) return null;

  async function schedule() {
    if (!prefill || busy || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setMessage('');
    try {
      const client = supabase();
      const { data: auth } = await client.auth.getUser();
      if (!auth.user) {
        const next = window.location.pathname + window.location.search;
        window.location.assign(`/login?next=${encodeURIComponent(next)}`);
        return;
      }
      const { data: existing } = await client.from('quests').select('id').eq('owner_id', auth.user.id).eq('active', true).eq('title', prefill.title).limit(1);
      if (Array.isArray(existing) && existing.length > 0) {
        setMessage('That quest is already on your board. Nothing new was saved.');
        return;
      }
      const { error } = await client.rpc('create_scheduled_quest', {
        p_title: prefill.title,
        p_domain: prefill.domain,
        p_cadence: prefill.cadence,
        p_date: prefill.date,
        p_quest_type: 'scheduled',
      });
      if (error) {
        setMessage(error.message);
        return;
      }
      setMessage('Quest scheduled. It is not complete, and no XP was awarded.');
      const url = new URL(window.location.href);
      url.searchParams.delete('quest');
      url.searchParams.delete('domain');
      url.searchParams.delete('cadence');
      url.searchParams.delete('date');
      window.history.replaceState({}, '', url.pathname + url.search + url.hash);
      setPrefill(null);
    } catch {
      setMessage('The quest was not confirmed. Refresh before trying again.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <section className="ascension-banner" aria-label="Schedule a prefilled quest">
      {prefill && <>
        <p className="eyebrow">QUEST DRAFT</p>
        <h2>{prefill.title}</h2>
        <p className="muted">Review it, then schedule it. Scheduling does not award XP.</p>
        <button type="button" className="btn" disabled={busy} onClick={() => { void schedule(); }}>{busy ? 'Scheduling…' : SCHEDULE_QUEST_LABEL}</button>
      </>}
      {message && <p className="message" role="status">{message}</p>}
    </section>
  );
}
