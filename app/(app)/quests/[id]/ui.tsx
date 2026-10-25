'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../../lib/supabase';

type Quest = { id: string; title: string; domain: string; cadence: string; active: boolean };
type Instance = { id: string; due_date: string; status: string };
type Note = {
  id: string;
  note: string;
  percent: number | null;
  source: string;
  created_at: string;
  instance_id: string | null;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function QuestNotes({ questId }: { questId: string }) {
  const validId = UUID_PATTERN.test(questId);
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [quest, setQuest] = useState<Quest | null>(null);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [note, setNote] = useState('');
  const [percent, setPercent] = useState('');
  const [instanceId, setInstanceId] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!validId) {
      setReady(true);
      return;
    }
    try {
      const client = supabase();
      const { data: authData, error: authError } = await client.auth.getUser();
      const user = authError ? null : authData.user;
      setUserId(user?.id ?? null);
      setReady(true);
      if (!user) return;
      const [questResult, noteResult, instanceResult] = await Promise.all([
        client.from('quests').select('id,title,domain,cadence,active').eq('id', questId).maybeSingle(),
        client.from('quest_progress').select('id,note,percent,source,created_at,instance_id').eq('quest_id', questId).order('created_at', { ascending: false }).limit(20),
        client.from('quest_instances').select('id,due_date,status').eq('quest_id', questId).order('due_date', { ascending: false }).limit(30),
      ]);
      if (questResult.error || noteResult.error || instanceResult.error) {
        setMessage(questResult.error?.message || noteResult.error?.message || instanceResult.error?.message || 'Unable to load notes.');
        return;
      }
      setQuest((questResult.data ?? null) as Quest | null);
      setNotes((noteResult.data ?? []) as Note[]);
      setInstances((instanceResult.data ?? []) as Instance[]);
    } catch {
      setMessage('Supabase is not configured in this browser.');
      setReady(true);
    }
  }, [questId, validId]);

  useEffect(() => {
    void load();
    try {
      const { data: { subscription } } = supabase().auth.onAuthStateChange(() => { void load(); });
      return () => subscription.unsubscribe();
    } catch {
      return;
    }
  }, [load]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !quest) return;
    const parsed = parsePercent(percent);
    if (parsed === 'invalid') {
      setMessage('Percent must be a whole number from 0 to 100, or left blank.');
      return;
    }
    const trimmed = note.trim();
    if (!trimmed || trimmed.length > 1000) {
      setMessage('Note must be 1 to 1000 characters.');
      return;
    }
    setBusy(true);
    const { error } = await supabase().rpc('add_quest_progress', {
      p_quest_id: quest.id,
      p_note: trimmed,
      p_percent: parsed,
      p_instance_id: instanceId || null,
      p_source: 'web',
    });
    setMessage(error?.message || 'Progress note saved.');
    if (!error) {
      setNote('');
      setPercent('');
      await load();
    }
    setBusy(false);
  }

  if (!validId) {
    return <main className="wrap"><h1>Quest notes</h1><p className="muted">That quest link is not valid.</p><a className="btn ghost" href="/quests">All notes</a></main>;
  }
  if (!ready) return <main className="wrap">Loading quest notes…</main>;
  if (!userId) {
    return (
      <main className="wrap">
        <div className="eyebrow">LIFE ASCENSION</div>
        <h1>Quest notes</h1>
        <p className="muted">Sign in to record progress.</p>
        <a className="btn" href={'/login?next=' + encodeURIComponent('/quests/' + questId)}>Sign in</a>
      </main>
    );
  }

  return (
    <main className="wrap">
      <header className="top">
        <div>
          <div className="eyebrow">LIFE ASCENSION</div>
          <h1>{quest?.title ?? 'Quest notes'}</h1>
          <p className="muted">Saving a note keeps a journal entry. XP is awarded only when you confirm completion on the quest board.</p>
        </div>
        <a className="btn ghost" href="/quests">All notes</a>
      </header>
      {!quest && <section className="panel"><p className="muted">Quest not found.</p></section>}
      {quest && (
        <form className="panel" onSubmit={save}>
          <h2>Add a progress note</h2>
          <label htmlFor="progress-note">What progress did you make?</label>
          <textarea id="progress-note" className="field" maxLength={1000} required value={note} onChange={(event) => setNote(event.target.value)} />
          <div className="form-row">
            <label htmlFor="progress-percent">Percent complete (optional)
              <input id="progress-percent" className="field" inputMode="numeric" min={0} max={100} step={1} value={percent} onChange={(event) => setPercent(event.target.value)} />
            </label>
            <label htmlFor="progress-instance">Existing instance (optional)
              <select id="progress-instance" className="field" value={instanceId} onChange={(event) => setInstanceId(event.target.value)}>
                <option value="">No instance</option>
                {instances.map((instance) => (
                  <option key={instance.id} value={instance.id}>{instance.due_date} · {instance.status}</option>
                ))}
              </select>
            </label>
          </div>
          <button className="btn" disabled={busy || !note.trim()}>Save note</button>
        </form>
      )}
      <section className="panel">
        <h2>Recent notes</h2>
        {notes.length === 0 && <p className="muted">No progress notes yet.</p>}
        {notes.map((entry) => (
          <div className="quest" key={entry.id}>
            <div className="quest-main">
              <div className="quest-title">{entry.note}</div>
              <div className="muted">
                {formatWhen(entry.created_at)} · {entry.source}
                {entry.percent != null ? ` · ${entry.percent}%` : ''}
                {entry.instance_id ? ' · Linked to an instance' : ''}
              </div>
            </div>
          </div>
        ))}
      </section>
      <p className="message" role="status" aria-live="polite">{message}</p>
      <p className="foot"><a href="/">Quest board</a> · <a href="/settings/api-keys">API keys</a> · <a href="/settings/password">Set or change password</a></p>
    </main>
  );
}

function parsePercent(value: string): number | null | 'invalid' {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d{1,3}$/.test(trimmed)) return 'invalid';
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100) return 'invalid';
  return parsed;
}

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}
