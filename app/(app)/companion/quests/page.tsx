'use client';

import { useState } from 'react';
import Link from 'next/link';
import { draftSourceLabel } from '../../../../lib/companionAccess';
import { companionStatusLabel } from '../../../../lib/companion';
import { fallbackQuestDrafts, type QuestCadence, type QuestDraft } from '../../../../lib/companionQuestDraft';
import { supabase } from '../../../../lib/supabase';
import { useCompanionBoard } from '../useCompanionBoard';

export default function CompanionQuestsPage() {
  const { board, ready, message, setMessage, reload } = useCompanionBoard();
  const [text, setText] = useState('');
  const [drafts, setDrafts] = useState<QuestDraft[]>([]);
  const [source, setSource] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const mine = (board?.quests ?? []).filter((quest) => quest.fromUser === board?.userId && quest.status !== 'declined');

  async function organize(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    let next = fallbackQuestDrafts(text);
    let nextSource: string = 'fallback';
    try {
      const response = await fetch('/api/companion/draft', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (response.ok) {
        const payload = await response.json() as { items?: QuestDraft[]; source?: string };
        if (Array.isArray(payload.items) && payload.items.length > 0) next = payload.items;
        if (payload.source === 'model' || payload.source === 'fallback') nextSource = payload.source;
      }
    } catch { /* Local splitter already filled next. */ }
    setDrafts(next);
    setSource(nextSource);
    setBusy(false);
  }

  async function send(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      for (const draft of drafts) {
        if (!draft.title.trim()) continue;
        const { error } = await supabase().rpc('companion_send_quest', {
          p_title: draft.title,
          p_description: draft.note,
          p_due: null,
          p_reward: '',
          p_cadence: draft.cadence,
        });
        if (error) throw new Error(error.message);
      }
      setDrafts([]);
      setText('');
      setSource(null);
      setMessage('Sent. Each one is on his board.');
      await reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return <main className="wrap companion-page"><p className="role-loading" role="status">Loading…</p></main>;
  const label = draftSourceLabel(source);
  return (
    <main className="wrap companion-page" id="send-quest">
      <h1>Quests</h1>
      <form onSubmit={(event) => void organize(event)}>
        <label htmlFor="brain-dump">Just type</label>
        <textarea id="brain-dump" className="field" maxLength={1000} value={text} onChange={(event) => setText(event.target.value)} />
        <button className="btn" type="submit" disabled={busy || text.trim().length < 1}>Turn into quests</button>
      </form>
      {label && <p className="companion-draft-source" role="status">{label}</p>}
      {drafts.length > 0 && (
        <form onSubmit={(event) => void send(event)}>
          {drafts.map((draft, index) => (
            <div className="companion-quest" key={`${draft.title}-${index}`}>
              <input className="field" maxLength={120} aria-label="Quest" value={draft.title} onChange={(event) => setDrafts((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, title: event.target.value } : row))} />
              <button className="btn companion-chip" type="button" onClick={() => setDrafts((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, cadence: (row.cadence === 'daily' ? 'weekly' : 'daily') as QuestCadence } : row))}>
                {draft.cadence === 'weekly' ? 'Weekly' : 'Daily'}
              </button>
            </div>
          ))}
          <button className="btn" type="submit" disabled={busy}>Send</button>
        </form>
      )}
      <p><Link href="/companion#off-day">Plan an off day or a repeating chore</Link></p>
      <h2>Yours</h2>
      {mine.length === 0 && <p className="muted">No quests yet.</p>}
      {mine.slice(0, 6).map((quest) => (
        <p key={quest.id}>{quest.title} · {companionStatusLabel(quest.status)}
          {quest.status !== 'completed' && (
            <button className="btn ghost" type="button" disabled={busy || quest.nudgedToday} onClick={() => void supabase().rpc('companion_nudge', { p_quest: quest.id }).then(() => reload())}>
              {quest.nudgedToday ? 'Nudged today' : 'Nudge'}
            </button>
          )}
        </p>
      ))}
      {message && <p className="message" role="status">{message}</p>}
    </main>
  );
}
