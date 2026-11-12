'use client';

import { useState } from 'react';
import Link from 'next/link';
import { QuestBoard } from '../../../../components/companion/QuestBoard';
import { draftSourceLabel } from '../../../../lib/companionAccess';
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
  // One board: daily, weekly and shared assignments are visible together.
  const visible = mine;
  const activeCount = visible.filter((quest) => quest.status !== 'completed').length;

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

  async function nudge(id: string) {
    setBusy(true);
    const { error } = await supabase().rpc('companion_nudge', { p_quest: id });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage('');
    await reload();
  }

  async function complete(id: string) {
    setBusy(true);
    const { data, error } = await supabase().rpc('companion_complete_quest', { p_quest: id });
    setBusy(false);
    if (error) {
      setMessage("Completion wasn't confirmed. Your progress hasn't changed.");
      return;
    }
    const receipt = data as { already?: boolean; xp_awarded?: number; xpAwarded?: number } | null;
    const xp = receipt?.xp_awarded ?? receipt?.xpAwarded ?? 0;
    setMessage(receipt?.already || xp < 1 ? 'Quest complete.' : `Quest complete. +${xp} XP.`);
    await reload();
  }

  if (!ready) return <main className="wrap companion-page"><p className="role-loading" role="status">Gathering your story…</p></main>;
  const label = draftSourceLabel(source);
  return (
    <main className="wrap companion-page" id="send-quest">
      <h1>Quests</h1>
      <p className="cq-level-line">{activeCount} active</p>
      <p className="muted">Daily, weekly and shared quests in one place. Your progress stays yours.</p>
      <form className="cq-notebook" onSubmit={(event) => void organize(event)}>
        <label htmlFor="brain-dump">Just type</label>
        <textarea id="brain-dump" className="field" maxLength={1000} placeholder="Example: yoga tonight, dishes after dinner, and a weekly cardboard run" value={text} onChange={(event) => setText(event.target.value)} />
        <button className="btn cq-spark" type="submit" disabled={busy || text.trim().length < 1}>Turn into quests</button>
      </form>
      {label && <p className="companion-draft-source" role="status">{label}</p>}
      {drafts.length > 0 && (
        <form className="companion-card" onSubmit={(event) => void send(event)}>
          {drafts.map((draft, index) => (
            <div className="cq-card is-open" key={`${draft.title}-${index}`}>
              <input className="field" maxLength={120} aria-label="Quest" value={draft.title} onChange={(event) => setDrafts((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, title: event.target.value } : row))} />
              <button className="btn companion-chip" type="button" onClick={() => setDrafts((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, cadence: (row.cadence === 'daily' ? 'weekly' : 'daily') as QuestCadence } : row))}>
                {draft.cadence === 'weekly' ? 'Weekly' : 'Daily'}
              </button>
            </div>
          ))}
          <button className="btn" type="submit" disabled={busy}>Send</button>
        </form>
      )}
      <p className="cq-planner"><Link href="/companion#off-day">Plan an off day or a repeating chore</Link></p>
      <QuestBoard quests={visible} userId={board?.userId} busy={busy} onNudge={(id) => void nudge(id)} onComplete={(id) => void complete(id)} />
      {message && <p className="message" role="status">{message.startsWith("Completion wasn't confirmed") ? message : message}</p>}
    </main>
  );
}
