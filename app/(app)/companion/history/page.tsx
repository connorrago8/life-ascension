'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { gameDayParts } from '../../../../lib/questStreak';
import { supabase } from '../../../../lib/supabase';
import { useCompanionBoard } from '../useCompanionBoard';

type Filter = 'all' | 'activities' | 'quests' | 'couple';
type ActivityRow = {
  id: string;
  title: string;
  note: string | null;
  xp_awarded: number | null;
  recorded_on: string | null;
  created_at: string;
  voided_at: string | null;
};

const FILTER_KEY = 'la.history.filter';

function gameDayOf(row: ActivityRow): string {
  if (row.recorded_on) return row.recorded_on;
  const parsed = new Date(row.created_at);
  return Number.isNaN(parsed.getTime()) ? '' : gameDayParts(parsed).date;
}

export default function CompanionHistoryPage() {
  const { board, ready, message, reload } = useCompanionBoard();
  const [rows, setRows] = useState<ActivityRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [entry, setEntry] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(FILTER_KEY);
      if (saved === 'all' || saved === 'activities' || saved === 'quests' || saved === 'couple') setFilter(saved);
    } catch { /* The filter stays on All. */ }
    setEntry(new URLSearchParams(window.location.search).get('entry'));
  }, []);

  useEffect(() => {
    if (!ready) return;
    let cancel = false;
    void supabase().from('companion_activities')
      .select('id, title, note, xp_awarded, recorded_on, created_at, voided_at')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (cancel) return;
        if (error) {
          setFailed(true);
          return;
        }
        setRows((data ?? []) as ActivityRow[]);
      });
    return () => { cancel = true; };
  }, [ready]);

  function choose(next: Filter) {
    setFilter(next);
    try { window.sessionStorage.setItem(FILTER_KEY, next); } catch { /* The choice still shows. */ }
  }

  const quests = (board?.quests ?? []).filter((quest) => quest.status === 'completed');
  const activities = rows ?? [];
  const selected = activities.find((row) => row.id === entry) ?? null;
  const groups = useMemo(() => {
    const map = new Map<string, ActivityRow[]>();
    for (const row of activities) {
      if (row.voided_at) continue;
      const day = gameDayOf(row) || 'Undated';
      map.set(day, [...(map.get(day) ?? []), row]);
    }
    return [...map.entries()];
  }, [activities]);
  const confirmed = activities.filter((row) => !row.voided_at).reduce((sum, row) => sum + (row.xp_awarded ?? 0), 0);

  if (!ready || rows === null && !failed) {
    return <main className="wrap companion-page"><p className="role-loading" role="status">Gathering your story…</p></main>;
  }
  if (failed || (message && !board)) {
    return (
      <main className="wrap companion-page">
        <h1>History</h1>
        <p className="message" role="status">History couldn't load. Your progress is safe.</p>
        <button className="btn ghost" type="button" onClick={() => void reload()}>Try again</button>
      </main>
    );
  }

  return (
    <main className="wrap companion-page">
      <h1>History</h1>
      <p className="muted">Confirmed activity XP: {confirmed}</p>
      <div className="cq-tabs" role="tablist" aria-label="History filters">
        {(['all', 'activities', 'quests', 'couple'] as const).map((item) => (
          <button key={item} className={filter === item ? 'btn' : 'btn ghost'} type="button" role="tab" aria-selected={filter === item} onClick={() => choose(item)}>
            {item === 'all' ? 'All' : item === 'activities' ? 'Activities' : item === 'quests' ? 'Quests' : 'Couple'}
          </button>
        ))}
      </div>
      {selected && (
        <section className="companion-card" aria-label="Entry">
          <h2>{selected.title}</h2>
          <p>{gameDayOf(selected)}</p>
          <p>{selected.voided_at ? 'Voided' : `This activity earned ${selected.xp_awarded ?? 0} XP.`}</p>
          {selected.note && <p className="muted">{selected.note}</p>}
          <Link className="btn ghost" href="/companion/history">Back</Link>
        </section>
      )}
      {(filter === 'couple' || ((!((filter === 'all' || filter === 'activities')) || groups.length === 0) && (!((filter === 'all' || filter === 'quests')) || quests.length === 0))) && (
        <p className="empty-state">Your completed adventures will appear here.</p>
      )}
      {filter !== 'quests' && filter !== 'couple' && groups.map(([day, items]) => (
        <section key={day} aria-label={day}>
          <h2 className="cq-section">{day}</h2>
          <ul className="cq-list">
            {items.map((row) => (
              <li key={row.id} className="cq-card is-open">
                <Link href={`/companion/history?entry=${row.id}`}>{row.title}</Link>
                <p className="muted">{row.xp_awarded ?? 0} XP</p>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {(filter === 'all' || filter === 'quests') && quests.map((quest) => (
        <article key={quest.id} className="cq-card is-done">
          <p className="cq-title">{quest.title}</p>
          <p className="muted">{quest.dueOn ?? 'Completed'}</p>
        </article>
      ))}
      <Link className="btn ghost" href="/">Back</Link>
    </main>
  );
}
