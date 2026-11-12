'use client';

import { useCallback, useEffect, useState } from 'react';
import '../../couple.css';
import { DateNightOffer } from '../../../components/couple/DateNightOffer';
import { SundayRecapCard } from '../../../components/couple/SundayRecapCard';
import { COUPLE_QUEST_PACK } from '../../../lib/coupleQuestPack';
import { parseDateNight, sanitizeDateNight, type DateNightPlan } from '../../../lib/dateNightPlan';
import { isSundayGameDay } from '../../../lib/coupleRecap';
import { shieldLabel } from '../../../lib/streakShield';
import { gameDayParts } from '../../../lib/questStreak';
import { supabase } from '../../../lib/supabase';

type Step = { id: string; position: number; title: string; done: boolean };
type Quest = {
  id: string;
  title: string;
  description: string | null;
  cadence: string;
  kind: string;
  dueAt: string | null;
  myDone: boolean;
  partnerDone: boolean;
  awarded: boolean;
  steps: Step[];
};
type Board = { role: string; companionXp: number; quests: Quest[] };

const PREVIEW_QUESTS: Quest[] = COUPLE_QUEST_PACK.slice(0, 4).map((quest, index) => ({
  id: `preview-${index}`,
  title: quest.title,
  description: quest.description,
  cadence: quest.cadence,
  kind: 'shared',
  dueAt: null,
  myDone: index === 0,
  partnerDone: false,
  awarded: false,
  steps: [],
}));

export default function TogetherPage() {
  const [preview, setPreview] = useState(false);
  const [ready, setReady] = useState(false);
  const [board, setBoard] = useState<Board | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('dinner and a movie Friday at 7');
  const [plan, setPlan] = useState<DateNightPlan | null>(null);
  const sunday = isSundayGameDay(gameDayParts(new Date()).date);

  const load = useCallback(async () => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('preview') === '1') {
      setPreview(true);
      setBoard({ role: 'adventurer', companionXp: 10, quests: PREVIEW_QUESTS });
      setPlan(parseDateNight('dinner and a movie Friday at 7'));
      setReady(true);
      return;
    }
    const { data, error } = await supabase().rpc('couple_board');
    if (error) {
      setMessage(error.message);
      setBoard(null);
    } else {
      setBoard(data as Board);
    }
    setReady(true);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function addPack() {
    setBusy(true);
    setMessage('');
    const { data, error } = await supabase().rpc('couple_add_quest_pack');
    setBusy(false);
    if (error) { setMessage(error.message); return; }
    const row = data as { added?: number; skipped?: number };
    setMessage(`Added ${row.added ?? 0}. Skipped ${row.skipped ?? 0} already on your list.`);
    await load();
  }

  async function mark(id: string) {
    if (preview) return;
    setBusy(true);
    setMessage('');
    const { data, error } = await supabase().rpc('couple_quest_mark', { p_quest: id });
    setBusy(false);
    if (error) { setMessage(error.message); return; }
    const row = data as { awarded?: boolean; already?: boolean; connorXp?: number; izzyXp?: number };
    if (row.awarded) setMessage(`Both done. Connor ${row.connorXp ?? 0} XP. Izzy ${row.izzyXp ?? 0} XP.`);
    else if (row.already) setMessage('Already awarded for this period.');
    else setMessage('Your part is marked. It awards when you both finish.');
    await load();
  }

  async function finishStep(id: string) {
    if (preview) return;
    setBusy(true);
    const { error } = await supabase().rpc('couple_step_done', { p_step: id });
    setBusy(false);
    if (error) setMessage(error.message);
    await load();
  }

  async function draftNight(event: React.FormEvent) {
    event.preventDefault();
    setMessage('');
    let next = parseDateNight(note);
    if (!preview) {
      try {
        const response = await fetch('/api/companion/draft', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ text: note }),
        });
        if (response.ok) {
          const payload = await response.json() as { dateNight?: unknown };
          next = sanitizeDateNight(payload.dateNight) ?? next;
        }
      } catch { /* The local parser already filled next. */ }
    }
    setPlan(next);
    if (!next) setMessage('That note needs a weekday, a time, and 2 to 5 steps.');
  }

  if (!ready) return <main className="wrap couple-page"><p role="status">Loading…</p></main>;

  return (
    <main className="wrap couple-page">
      <p className="couple-kicker">LIFE ASCENSION</p>
      <h1>Together</h1>
      <p className="muted">Shared quests for a bonded pair. Connor’s XP stays on his quest streak. Izzy’s share is {board?.companionXp ?? 10} XP in her own ledger, once.</p>
      {preview && <p className="preview-banner" role="status">Layout preview. Sign in to use your bond.</p>}
      {preview && <p className="streak-shield" role="status">{shieldLabel('used', '2026-03-13')}</p>}
      {(sunday || preview) && (
        <section className="couple-card" aria-label="Sunday recap">
          {preview ? (
            <div className="couple-recap-grid">
              <div className="couple-partner"><strong>Connor</strong><span>4 done</span><span>42 XP</span><span>1 levels</span><span>Longest streak 6</span></div>
              <div className="couple-partner"><strong>Izzy</strong><span>3 done</span><span>30 XP</span><span>1 levels</span><span>Longest streak 3</span></div>
            </div>
          ) : <SundayRecapCard />}
        </section>
      )}
      <section className="couple-card" aria-label="Starter pack">
        <h2>Starter pack</h2>
        <p className="muted">Fifteen shared quests. A second tap skips titles you already have.</p>
        <button className="btn" type="button" disabled={busy || preview} onClick={() => void addPack()}>Add the 15</button>
      </section>
      <section className="couple-card" aria-label="Date night planner">
        <h2>Date night</h2>
        <form onSubmit={(event) => void draftNight(event)}>
          <label htmlFor="date-night-note">Say it in one line</label>
          <textarea id="date-night-note" className="field" maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} />
          <button className="btn" type="submit" disabled={busy || note.trim().length < 1}>Plan it</button>
        </form>
        {plan && <DateNightOffer plan={plan} onSaved={() => void load()} />}
      </section>
      <section aria-label="Shared quests">
        <h2>Shared quests</h2>
        {(board?.quests ?? []).length === 0 && <p className="muted">Nothing shared yet.</p>}
        {(board?.quests ?? []).map((quest) => (
          <article className="couple-card" key={quest.id}>
            <p className="couple-meta">{quest.cadence}{quest.kind === 'date_night' ? ' · date night' : ''}</p>
            <h2>{quest.title}</h2>
            {quest.description && <p>{quest.description}</p>}
            {quest.dueAt && <p className="muted">Due {new Date(quest.dueAt).toLocaleString()}</p>}
            <p className="muted">{quest.myDone ? 'You marked done' : 'Your part is open'} · {quest.partnerDone ? 'Partner marked done' : 'Partner still open'}{quest.awarded ? ' · Awarded' : ''}</p>
            {quest.steps.length > 0 && (
              <ol className="couple-steps">
                {quest.steps.map((step) => (
                  <li key={step.id}>
                    {step.title}
                    {step.done ? ' · done' : (
                      <button className="btn ghost" type="button" disabled={busy || preview} onClick={() => void finishStep(step.id)}>Mark step</button>
                    )}
                  </li>
                ))}
              </ol>
            )}
            <div className="couple-actions">
              <button className="btn" type="button" disabled={busy || preview || quest.myDone} onClick={() => void mark(quest.id)}>
                {quest.myDone ? 'Marked' : 'Mark my part'}
              </button>
            </div>
          </article>
        ))}
      </section>
      {message && <p className="message" role="status">{message}</p>}
    </main>
  );
}
