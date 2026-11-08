'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { COMPANION_TITLES } from '../../../lib/companion';
import { supabase } from '../../../lib/supabase';

type Bond = {
  id: string;
  status: 'pending' | 'active' | 'revoked';
  role: 'inviter' | 'companion';
  expiresAt: string;
  partnerId: string | null;
  partnerName: string | null;
  partnerTitle: string | null;
};
type QuestRow = {
  id: string;
  title: string;
  description: string | null;
  dueOn: string | null;
  rewardText: string | null;
  status: 'sent' | 'accepted' | 'declined' | 'completed';
  fromUser: string;
  toUser: string;
};
type ActivityRow = {
  id: string;
  title: string;
  note: string | null;
  recordedBy: string;
  subjectId: string;
  xp: number | null;
  voided: boolean;
};
type Board = {
  userId: string;
  bond: Bond | null;
  identity: { displayName: string; title: string } | null;
  quests: QuestRow[];
  activities: ActivityRow[];
};

export default function CompanionPage() {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [board, setBoard] = useState<Board | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  const [freshCode, setFreshCode] = useState('');
  const [name, setName] = useState('');
  const [title, setTitle] = useState<string>(COMPANION_TITLES[0]);
  const [questTitle, setQuestTitle] = useState('');
  const [questDescription, setQuestDescription] = useState('');
  const [questDue, setQuestDue] = useState('');
  const [questReward, setQuestReward] = useState('');
  const [activityTitle, setActivityTitle] = useState('');
  const [activityNote, setActivityNote] = useState('');

  const load = useCallback(async () => {
    const client = supabase();
    const { data: authData, error: authError } = await client.auth.getUser();
    const user = authError ? null : authData.user;
    setSignedIn(!!user);
    setReady(true);
    if (!user) {
      setBoard(null);
      return;
    }
    const { data, error } = await client.rpc('companion_state');
    if (error) {
      setMessage(error.message);
      return;
    }
    const next = data as Board;
    setBoard(next);
    if (next.identity) {
      setName(next.identity.displayName);
      setTitle(next.identity.title);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage('');
    try {
      await action();
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  function fail(error: { message: string } | null) {
    if (error) throw new Error(error.message);
  }

  return (
    <main className="wrap companion-page">
      <Link className="btn ghost companion-back" href="/">Back</Link>
      <header>
        <div className="eyebrow">LIFE ASCENSION</div>
        <h1>Companion</h1>
        <p className="muted">Invite one person. They use their own account. Quests use the normal 10 XP streak.</p>
      </header>
      {!ready && <p>Loading…</p>}
      {ready && !signedIn && (
        <section className="panel companion-card">
          <h2>Sign in first</h2>
          <p className="muted">An invitation does not share your account.</p>
          <Link className="btn" href="/login?next=%2Fcompanion">Sign in</Link>
        </section>
      )}
      {board && (!board.bond || board.bond.status === 'revoked') && (
        <section className="panel companion-card">
          <h2>Invite your companion</h2>
          <p className="muted">The code is shown once. They sign in on their own account and accept it.</p>
          <button className="btn" type="button" disabled={busy} onClick={() => void run(async () => {
            const { data, error } = await supabase().rpc('companion_invite');
            fail(error);
            setFreshCode(String((data as { code?: string }).code ?? ''));
          })}>Create invitation</button>
          {freshCode && <p className="companion-code" role="status">Code: {freshCode}</p>}
          <form onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              const { error } = await supabase().rpc('companion_accept', { p_code: code });
              fail(error);
              setCode('');
            });
          }}>
            <h2>Accept an invitation</h2>
            <label htmlFor="invite-code">Invitation code</label>
            <input id="invite-code" className="field" value={code} autoComplete="off" onChange={(event) => setCode(event.target.value)} />
            <button className="btn" type="submit" disabled={busy || code.trim().length < 8}>Accept</button>
          </form>
        </section>
      )}
      {board?.bond && board.bond.status !== 'revoked' && (
        <section className="panel companion-card">
          <h2>{board.bond.status === 'active' ? 'Connected' : board.bond.status === 'pending' ? 'Invitation pending' : 'Connection closed'}</h2>
          {board.bond.partnerName && <p>{board.bond.partnerName}{board.bond.partnerTitle ? ` · ${board.bond.partnerTitle}` : ''}</p>}
          {freshCode && board.bond.status === 'pending' && <p className="companion-code" role="status">Code: {freshCode}</p>}
          <div className="companion-actions">
            <button className="btn ghost" type="button" disabled={busy} onClick={() => void run(async () => {
              const { error } = await supabase().rpc('companion_revoke', { p_bond: board.bond!.id });
              fail(error);
            })}>Revoke</button>
          </div>
        </section>
      )}
      {board?.bond?.status === 'active' && board.bond.role === 'companion' && (
        <>
          <section className="panel companion-card">
            <h2>Your identity</h2>
            <form onSubmit={(event) => {
              event.preventDefault();
              void run(async () => {
                const { error } = await supabase().rpc('companion_set_identity', { p_name: name, p_title: title });
                fail(error);
                setMessage('Identity saved.');
              });
            }}>
              <label htmlFor="companion-name">Display name</label>
              <input id="companion-name" className="field" maxLength={40} value={name} onChange={(event) => setName(event.target.value)} required />
              <label htmlFor="companion-title">Title</label>
              <select id="companion-title" className="field" value={title} onChange={(event) => setTitle(event.target.value)}>
                {COMPANION_TITLES.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <button className="btn" type="submit" disabled={busy}>Save identity</button>
            </form>
          </section>
          <section className="panel companion-card">
            <h2>Give a quest</h2>
            <form onSubmit={(event) => {
              event.preventDefault();
              void run(async () => {
                const { error } = await supabase().rpc('companion_send_quest', {
                  p_title: questTitle,
                  p_description: questDescription,
                  p_due: questDue || null,
                  p_reward: questReward,
                });
                fail(error);
                setQuestTitle('');
                setQuestDescription('');
                setQuestDue('');
                setQuestReward('');
                setMessage('Quest sent. No XP until they complete it.');
              });
            }}>
              <label htmlFor="quest-title">Title</label>
              <input id="quest-title" className="field" maxLength={120} value={questTitle} onChange={(event) => setQuestTitle(event.target.value)} required />
              <label htmlFor="quest-description">Description (optional)</label>
              <textarea id="quest-description" className="field" maxLength={500} value={questDescription} onChange={(event) => setQuestDescription(event.target.value)} />
              <label htmlFor="quest-due">Due date (optional)</label>
              <input id="quest-due" className="field" type="date" value={questDue} onChange={(event) => setQuestDue(event.target.value)} />
              <label htmlFor="quest-reward">Real-life reward (optional)</label>
              <input id="quest-reward" className="field" maxLength={200} value={questReward} onChange={(event) => setQuestReward(event.target.value)} />
              <button className="btn" type="submit" disabled={busy || !questTitle.trim()}>Send quest</button>
            </form>
          </section>
        </>
      )}
      {board?.bond?.status === 'active' && board.bond.role === 'inviter' && (
        <section className="panel companion-card">
          <h2>Log their real-life activity</h2>
          <p className="muted">This awards their normal quest XP on their account. You can void it later.</p>
          <form onSubmit={(event) => {
            event.preventDefault();
            const requestId = crypto.randomUUID();
            void run(async () => {
              const { data, error } = await supabase().rpc('companion_log_activity', {
                p_request: requestId,
                p_title: activityTitle,
                p_note: activityNote,
              });
              fail(error);
              const awarded = Number((data as { xpAwarded?: number }).xpAwarded ?? 0);
              setActivityTitle('');
              setActivityNote('');
              setMessage(awarded > 0 ? `Logged. +${awarded} XP on their account.` : 'Already logged for this game day.');
            });
          }}>
            <label htmlFor="activity-title">What did they do?</label>
            <input id="activity-title" className="field" maxLength={120} value={activityTitle} onChange={(event) => setActivityTitle(event.target.value)} required />
            <label htmlFor="activity-note">Note (optional)</label>
            <textarea id="activity-note" className="field" maxLength={500} value={activityNote} onChange={(event) => setActivityNote(event.target.value)} />
            <button className="btn" type="submit" disabled={busy || !activityTitle.trim()}>Log activity</button>
          </form>
        </section>
      )}
      {board && board.quests.length > 0 && (
        <section className="panel companion-card" aria-label="Companion quests">
          <h2>Quests</h2>
          {board.quests.map((quest) => (
            <article className="companion-quest" key={quest.id}>
              <h3>{quest.title}</h3>
              {quest.description && <p>{quest.description}</p>}
              <p className="muted">{quest.status}{quest.dueOn ? ` · due ${quest.dueOn}` : ''}{quest.rewardText ? ` · reward: ${quest.rewardText}` : ''}</p>
              {board.bond?.role === 'inviter' && quest.status === 'sent' && (
                <div className="companion-actions">
                  <button className="btn" type="button" disabled={busy} onClick={() => void run(async () => {
                    const { error } = await supabase().rpc('companion_respond_quest', { p_quest: quest.id, p_accept: true });
                    fail(error);
                  })}>Accept</button>
                  <button className="btn ghost" type="button" disabled={busy} onClick={() => void run(async () => {
                    const { error } = await supabase().rpc('companion_respond_quest', { p_quest: quest.id, p_accept: false });
                    fail(error);
                  })}>Decline</button>
                </div>
              )}
              {board.bond?.role === 'inviter' && quest.status === 'accepted' && (
                <button className="btn" type="button" disabled={busy} onClick={() => void run(async () => {
                  const { data, error } = await supabase().rpc('companion_complete_quest', { p_quest: quest.id });
                  fail(error);
                  const xp = Number((data as { xp_awarded?: number }).xp_awarded ?? 0);
                  setMessage(xp > 0 ? `Completed. +${xp} XP.` : 'Completed. No extra XP.');
                })}>Complete</button>
              )}
            </article>
          ))}
        </section>
      )}
      {board && board.activities.length > 0 && (
        <section className="panel companion-card" aria-label="Logged activities">
          <h2>Activities</h2>
          {board.activities.map((activity) => (
            <article className="companion-activity" key={activity.id}>
              <h3>{activity.title}</h3>
              {activity.note && <p>{activity.note}</p>}
              <p className="muted">Recorded by {activity.recordedBy === board.userId ? 'you' : 'your companion'}{activity.xp ? ` · ${activity.xp} XP` : ''}{activity.voided ? ' · voided' : ''}</p>
              {!activity.voided && (activity.recordedBy === board.userId || activity.subjectId === board.userId) && (
                <button className="btn ghost" type="button" disabled={busy} onClick={() => void run(async () => {
                  const { error } = await supabase().rpc('companion_void_activity', { p_activity: activity.id });
                  fail(error);
                  setMessage('Activity voided. The XP reversal is on their account.');
                })}>Void</button>
              )}
            </article>
          ))}
        </section>
      )}
      {message && <p className="message" role="status">{message}</p>}
    </main>
  );
}
