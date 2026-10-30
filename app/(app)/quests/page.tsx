'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { questDetailHref, shouldOpenQuestCard } from '../../../lib/questCardTap';

type Quest = { id: string; title: string; domain: string; cadence: string; active: boolean };
type InstanceStatus = { quest_id: string; due_date: string; status: 'available' | 'completed' | 'deferred' };
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

function todayLocal() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export default function QuestNotesIndex() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [doneQuestIds, setDoneQuestIds] = useState<Set<string>>(new Set());
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
      const loadedQuests = (questResult.data ?? []) as Quest[];
      // Issue #46: mirror the Today board. A daily quest completed today and a
      // completed one-time quest are shown as done, not as open/active work.
      const today = todayLocal();
      const onceIds = loadedQuests.filter((quest) => quest.active && quest.cadence !== 'daily').map((quest) => quest.id);
      const [todayResult, onceResult] = await Promise.all([
        client.from('quest_instances').select('quest_id,due_date,status').eq('owner_id', user.id).eq('due_date', today).limit(1000),
        onceIds.length
          ? client.from('quest_instances').select('quest_id,due_date,status').eq('owner_id', user.id).in('quest_id', onceIds).eq('status', 'completed').limit(1000)
          : Promise.resolve({ data: [] as InstanceStatus[], error: null }),
      ]);
      if (todayResult.error || onceResult.error) {
        setMessage(todayResult.error?.message || onceResult.error?.message || 'Unable to load quest status.');
        return;
      }
      const done = new Set<string>();
      for (const row of [...((todayResult.data ?? []) as InstanceStatus[]), ...((onceResult.data ?? []) as InstanceStatus[])]) {
        if (row.status === 'completed') done.add(row.quest_id);
      }
      setQuests(loadedQuests);
      setNotes((noteResult.data ?? []) as Note[]);
      setDoneQuestIds(done);
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

  const activeQuests = quests.filter((quest) => quest.active && !doneQuestIds.has(quest.id));
  const doneQuests = quests.filter((quest) => quest.active && doneQuestIds.has(quest.id));
  const inactiveQuests = quests.filter((quest) => !quest.active);
  const renderQuest = (quest: Quest) => {
    const latest = notes.find((note) => note.quest_id === quest.id);
    const done = doneQuestIds.has(quest.id);
    return <div className="quest quest-tappable" key={quest.id} onClick={(event) => { if (shouldOpenQuestCard(event.target as Element, String(window.getSelection?.() ?? ''))) router.push(questDetailHref(quest.id)); }}><div className="quest-main"><div className="quest-title"><Link className="quest-title-link" href={questDetailHref(quest.id)} prefetch={false} aria-label={`Open ${quest.title}`}>{quest.title}</Link></div><div className="muted">{DOMAINS[quest.domain] ?? quest.domain} · {quest.cadence === 'daily' ? 'Daily' : 'One-time'}{doneQuestIds.has(quest.id) ? (quest.cadence === 'daily' ? ' · ✓ Done today' : ' · ✓ Completed') : ''}</div>{latest && <p className="muted">{preview(latest.note)}{latest.percent != null ? ` · ${latest.percent}%` : ''}</p>}</div><div className="actions">{done && quest.active ? <span className="tag" aria-label={`${quest.title} done`}>✓ Done</span> : <a className="btn ghost" href={questDetailHref(quest.id)}>View progress</a>}</div></div>;
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
      <section className="panel" aria-label="Active quest journal"><h2>Active quests ({activeQuests.length})</h2>{activeQuests.length === 0 && <p className="muted">{doneQuests.length > 0 ? 'All caught up for today.' : 'No active quests. Add one from Home.'}</p>}{activeQuests.map(renderQuest)}</section>
      {doneQuests.length > 0 && <section className="panel" aria-label="Done today journal"><h2>Done today &amp; completed ({doneQuests.length})</h2><p className="muted">Daily quests reopen tomorrow on the quest board.</p>{doneQuests.map(renderQuest)}</section>}
      {inactiveQuests.length > 0 && <section className="panel"><button type="button" className="btn ghost" aria-expanded={showInactive} onClick={() => setShowInactive(value => !value)}>{showInactive ? '▾' : '▸'} Archived quests ({inactiveQuests.length})</button>{showInactive && inactiveQuests.map(renderQuest)}</section>}
      <p className="message" role="status" aria-live="polite">{message}</p>
    </main>
  );
}

function preview(note: string) {
  return note.length > 140 ? `${note.slice(0, 140)}…` : note;
}
