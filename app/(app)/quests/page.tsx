'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';

type Quest = { id: string; title: string; domain: string; cadence: string; active: boolean };
type Note = { id: string; quest_id: string; note: string; percent: number | null; created_at: string };

const DOMAINS: Record<string, string> = {
  hygiene: 'Hygiene & appearance',
  home: 'Home & environment',
  mental_health: 'Mental health & recovery',
  personal_growth: 'Growth & hobbies',
  finance: 'Financial health',
  career: 'Career & productivity',
  relationships: 'Relationships',
  physical_health: 'Physical health',
};

export default function QuestNotesIndex() {
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [message, setMessage] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  const load = useCallback(async () => {
    try {
      const client = supabase();
      const { data: authData, error: authError } = await client.auth.getUser();
      const user = authError ? null : authData.user;
      setUserId(user?.id ?? null);
      setReady(true);
      if (!user) return;
      const [questResult, noteResult] = await Promise.all([
        client.from('quests').select('id,title,domain,cadence,active').order('created_at', { ascending: true }),
        client.from('quest_progress').select('id,quest_id,note,percent,created_at').order('created_at', { ascending: false }).limit(100),
      ]);
      if (questResult.error || noteResult.error) {
        setMessage(questResult.error?.message || noteResult.error?.message || 'Unable to load quest notes.');
        return;
      }
      setQuests((questResult.data ?? []) as Quest[]);
      setNotes((noteResult.data ?? []) as Note[]);
    } catch {
      setMessage('Supabase is not configured in this browser.');
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void load();
    try {
      const { data: { subscription } } = supabase().auth.onAuthStateChange(() => { void load(); });
      return () => subscription.unsubscribe();
    } catch {
      return;
    }
  }, [load]);

  if (!ready) return <main className="wrap">Loading quest notes…</main>;
  if (!userId) {
    return (
      <main className="wrap">
        <div className="eyebrow">LIFE ASCENSION</div>
        <h1>Quest notes</h1>
        <p className="muted">Sign in to record progress on your quests.</p>
        <a className="btn" href="/login?next=%2Fquests">Sign in</a>
      </main>
    );
  }

  const activeQuests = quests.filter((quest) => quest.active);
  const inactiveQuests = quests.filter((quest) => !quest.active);
  const renderQuest = (quest: Quest) => {
    const latest = notes.find((note) => note.quest_id === quest.id);
    return <div className="quest" key={quest.id}><div className="quest-main"><div className="quest-title">{quest.title}</div><div className="muted">{DOMAINS[quest.domain] ?? quest.domain} · {quest.cadence === 'daily' ? 'Daily' : 'One-time'}</div>{latest && <p className="muted">{preview(latest.note)}{latest.percent != null ? ` · ${latest.percent}%` : ''}</p>}</div><div className="actions"><a className="btn ghost" href={`/quests/${quest.id}`}>View progress</a></div></div>;
  };

  return (
    <main className="wrap">
      <header className="top">
        <div>
          <div className="eyebrow">LIFE ASCENSION</div>
          <h1>Quest journal</h1>
          <p className="muted">Track notes and progress here. Complete quests on Home to earn XP.</p>
        </div>
        <a className="btn ghost" href="/">Quest board</a>
      </header>
      <section className="panel" aria-label="Active quest journal"><h2>Active quests ({activeQuests.length})</h2>{activeQuests.length === 0 && <p className="muted">No active quests. Add one from Home.</p>}{activeQuests.map(renderQuest)}</section>
      {inactiveQuests.length > 0 && <section className="panel"><button type="button" className="btn ghost" aria-expanded={showInactive} onClick={() => setShowInactive(value => !value)}>{showInactive ? '▾' : '▸'} Archived quests ({inactiveQuests.length})</button>{showInactive && inactiveQuests.map(renderQuest)}</section>}
      <p className="message" role="status" aria-live="polite">{message}</p>
    </main>
  );
}

function preview(note: string) {
  return note.length > 140 ? `${note.slice(0, 140)}…` : note;
}
