'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { collapseCompanionQuests, companionStatusLabel, COMPANION_COLORS, COMPANION_TITLES } from '../../../lib/companion';
import { CompanionHome, type CompanionView } from './CompanionHome';
import { COMPANION_INVITE_STORAGE_KEY, companionInvitePath, readInviteCode } from '../../../lib/companionInvite';
import { fallbackQuestDrafts, type QuestCadence, type QuestDraft } from '../../../lib/companionQuestDraft';
import { gameDayParts, weekStart } from '../../../lib/questStreak';
import { supabase } from '../../../lib/supabase';
import { Tutorial } from './Tutorial';

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
  cadence?: string | null;
  instanceId?: string | null;
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
  identity: { displayName: string; title: string; questColor?: string; avatarPath?: string | null } | null;
  quests: QuestRow[];
  activities: ActivityRow[];
  notices?: CompanionView['notices'];
  rewards?: CompanionView['rewards'];
  repeats?: CompanionView['repeats'];
  recap?: CompanionView['recap'];
  milestones?: CompanionView['milestones'];
  tipsSeen?: string[];
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
  const [color, setColor] = useState<string>(COMPANION_COLORS[0]);
  const [questTitle, setQuestTitle] = useState('');
  const [questCadence, setQuestCadence] = useState<QuestCadence>('daily');
  const [cadenceTouched, setCadenceTouched] = useState(false);
  const [questDescription, setQuestDescription] = useState('');
  const [questDue, setQuestDue] = useState(() => gameDayParts(new Date()).date);
  const [questReward, setQuestReward] = useState('');
  const [activityTitle, setActivityTitle] = useState('');
  const [activityNote, setActivityNote] = useState('');
  const [justType, setJustType] = useState(false);
  const [brainDump, setBrainDump] = useState('');
  const [drafts, setDrafts] = useState<QuestDraft[]>([]);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showConnorTip, setShowConnorTip] = useState(false);

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
      if (next.identity.questColor) setColor(next.identity.questColor);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const fromLink = readInviteCode(window.location.search);
    if (fromLink) {
      localStorage.setItem(COMPANION_INVITE_STORAGE_KEY, fromLink);
      setCode(fromLink);
      return;
    }
    const stored = localStorage.getItem(COMPANION_INVITE_STORAGE_KEY) ?? '';
    if (readInviteCode(`?invite=${stored}`)) setCode(stored);
  }, []);

  useEffect(() => {
    if (!board || board.bond?.status !== 'active') return;
    let cancel = false;
    void supabase().from('companion_tutorial_seen').select('izzy_seen_at, connor_tip_seen_at').eq('user_id', board.userId).maybeSingle()
      .then(({ data }) => {
        if (cancel) return;
        if (data?.izzy_seen_at) localStorage.setItem('life-ascension-tutorial-izzy', board.userId);
        if (data?.connor_tip_seen_at) localStorage.setItem('life-ascension-tutorial-connor', board.userId);
        const izzySeen = localStorage.getItem('life-ascension-tutorial-izzy') === board.userId;
        const connorSeen = localStorage.getItem('life-ascension-tutorial-connor') === board.userId;
        if (board.bond?.role === 'companion' && !izzySeen) setShowTutorial(true);
        if (board.bond?.role === 'inviter' && !connorSeen && board.quests.some((quest) => quest.status === 'accepted' || quest.status === 'completed')) {
          setShowConnorTip(true);
        }
      });
    return () => { cancel = true; };
  }, [board]);

  function rememberTutorial(which: 'izzy' | 'connor') {
    if (!board) return;
    const key = which === 'izzy' ? 'life-ascension-tutorial-izzy' : 'life-ascension-tutorial-connor';
    localStorage.setItem(key, board.userId);
    const patch = which === 'izzy' ? { izzy_seen_at: new Date().toISOString() } : { connor_tip_seen_at: new Date().toISOString() };
    void supabase().from('companion_tutorial_seen').upsert({ user_id: board.userId, ...patch });
    if (which === 'izzy') setShowTutorial(false);
    else setShowConnorTip(false);
  }

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

  function tipSeen(key: string) {
    return (board?.tipsSeen ?? []).includes(key);
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
          <Link className="btn" href={`/login?mode=signup&next=${encodeURIComponent(code ? companionInvitePath(code) : '/companion')}`}>Create account</Link>
          <Link className="btn ghost" href={`/login?next=${encodeURIComponent(code ? companionInvitePath(code) : '/companion')}`}>Sign in</Link>
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
          {freshCode && (
            <div>
              <p className="companion-code" role="status">Code: {freshCode}</p>
              <button className="btn" type="button" onClick={() => {
                const link = `${window.location.origin}${companionInvitePath(freshCode)}`;
                void navigator.clipboard?.writeText(link);
                setMessage('Link copied. Text it to her.');
              }}>Copy link</button>
            </div>
          )}
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
          {freshCode && board.bond.status === 'pending' && (
            <div>
              <p className="companion-code" role="status">Code: {freshCode}</p>
              <button className="btn" type="button" onClick={() => {
                const link = `${window.location.origin}${companionInvitePath(freshCode)}`;
                void navigator.clipboard?.writeText(link);
                setMessage('Link copied. Text it to her.');
              }}>Copy link</button>
            </div>
          )}
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
                const { error } = await supabase().rpc('companion_set_identity', { p_name: name, p_title: title, p_color: color });
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
              <label htmlFor="companion-color">Quest color</label>
              <select id="companion-color" className="field" value={color} onChange={(event) => setColor(event.target.value)}>
                {COMPANION_COLORS.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <button className="btn" type="submit" disabled={busy}>Save identity</button>
            </form>
          </section>
          <section className="panel companion-card" id="send-quest">
            <h2>Send Connor a quest</h2>
            <button className="btn ghost" type="button" aria-pressed={justType} onClick={() => setJustType((value) => !value)}>
              {justType ? 'Use the form' : 'Just type'}
            </button>
            {justType ? (
              <form onSubmit={(event) => {
                event.preventDefault();
                void run(async () => {
                  let next = fallbackQuestDrafts(brainDump);
                  try {
                    const response = await fetch('/api/companion/draft', {
                      method: 'POST',
                      headers: { 'content-type': 'application/json' },
                      body: JSON.stringify({ text: brainDump }),
                    });
                    if (response.ok) {
                      const payload = await response.json() as { items?: QuestDraft[] };
                      if (Array.isArray(payload.items) && payload.items.length > 0) next = payload.items;
                    }
                  } catch { /* The local splitter already filled next. */ }
                  setDrafts(next);
                  setMessage(next.length ? 'Check the list, then send.' : 'No quests found in that note.');
                });
              }}>
                <label htmlFor="brain-dump">Type everything on your mind</label>
                <textarea id="brain-dump" className="field" maxLength={1000} value={brainDump} onChange={(event) => setBrainDump(event.target.value)} />
                <button className="btn" type="submit" disabled={busy || brainDump.trim().length < 1}>Turn into quests</button>
              </form>
            ) : (
            <form onSubmit={(event) => {
              event.preventDefault();
              void run(async () => {
                const { error } = await supabase().rpc('companion_send_quest', {
                  p_title: questTitle,
                  p_description: questDescription,
                  p_due: questDue || null,
                  p_reward: questReward,
                  p_cadence: questCadence,
                });
                fail(error);
                setQuestTitle('');
                setQuestDescription('');
                setQuestReward('');
                setCadenceTouched(false);
                setQuestCadence('daily');
                setMessage('Quest sent. It is on his board. No XP until he completes it.');
              });
            }}>
              <label htmlFor="quest-title">Title</label>
              <input id="quest-title" className="field" maxLength={120} value={questTitle} onChange={(event) => {
                const value = event.target.value;
                setQuestTitle(value);
                if (!cadenceTouched) setQuestCadence(fallbackQuestDrafts(value)[0]?.cadence ?? 'daily');
              }} required />
              <button className="btn companion-chip" type="button" onClick={() => {
                setCadenceTouched(true);
                setQuestCadence((value) => value === 'daily' ? 'weekly' : 'daily');
              }}>{questCadence === 'weekly' ? 'Weekly' : 'Daily'}</button>
              <label htmlFor="quest-description">Description (optional)</label>
              <textarea id="quest-description" className="field" maxLength={500} value={questDescription} onChange={(event) => {
                const value = event.target.value;
                setQuestDescription(value);
                if (!cadenceTouched) setQuestCadence(fallbackQuestDrafts(`${questTitle}. ${value}`)[0]?.cadence ?? 'daily');
              }} />
              <label htmlFor="quest-due">Due date (optional)</label>
              <input id="quest-due" className="field" type="date" value={questDue} onChange={(event) => setQuestDue(event.target.value)} />
              <label htmlFor="quest-reward">Real-life reward (optional)</label>
              <input id="quest-reward" className="field" maxLength={200} value={questReward} onChange={(event) => setQuestReward(event.target.value)} />
              <button className="btn" type="submit" disabled={busy || !questTitle.trim()}>Send quest</button>
            </form>
            )}
          {tipSeen('izzy-send') ? null : (
            <p className="companion-tip">Send puts it on his board right away. Daily is a same-day chore. Weekly is a bigger job for this week.
              <button className="btn ghost" type="button" onClick={() => void run(async () => {
                const { error } = await supabase().rpc('companion_dismiss_tip', { p_key: 'izzy-send' });
                fail(error);
              })}>Got it</button>
            </p>
          )}
            {drafts.length > 0 && (
              <form className="companion-draft" onSubmit={(event) => {
                event.preventDefault();
                void run(async () => {
                  for (const draft of drafts) {
                    if (!draft.title.trim()) continue;
                    const { error } = await supabase().rpc('companion_send_quest', {
                      p_title: draft.title,
                      p_description: draft.note,
                      p_due: questDue || null,
                      p_reward: '',
                      p_cadence: draft.cadence,
                    });
                    fail(error);
                  }
                  setDrafts([]);
                  setBrainDump('');
                  setMessage('Sent. Each one is on his board. No XP until he finishes it.');
                });
              }}>
                <label htmlFor="draft-day">Day for all of these</label>
                <input id="draft-day" className="field" type="date" value={questDue} onChange={(event) => setQuestDue(event.target.value)} />
                {drafts.map((draft, index) => (
                  <div className="companion-quest" key={`${draft.title}-${index}`}>
                    <label htmlFor={`draft-title-${index}`}>Quest</label>
                    <input id={`draft-title-${index}`} className="field" maxLength={120} value={draft.title} onChange={(event) => setDrafts((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, title: event.target.value } : row))} />
                    <button className="btn companion-chip" type="button" onClick={() => setDrafts((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, cadence: (row.cadence === 'daily' ? 'weekly' : 'daily') as QuestCadence } : row))}>
                      {draft.cadence === 'weekly' ? 'Weekly' : 'Daily'}
                    </button>
                    <button className="btn ghost" type="button" onClick={() => setDrafts((rows) => rows.filter((_, rowIndex) => rowIndex !== index))}>Delete</button>
                  </div>
                ))}
                <button className="btn ghost" type="button" onClick={() => setDrafts((rows) => rows.length >= 10 ? rows : [...rows, { title: '', note: '', cadence: 'daily' }])}>Add a quest</button>
                <button className="btn" type="submit" disabled={busy || drafts.every((draft) => !draft.title.trim())}>Send</button>
              </form>
            )}
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
          {(board.bond?.role === 'companion' ? collapseCompanionQuests(board.quests) : board.quests).map((quest) => {
            const today = gameDayParts(new Date()).date;
            const future = !!quest.dueOn && (quest.cadence === 'weekly' ? weekStart(quest.dueOn) > weekStart(today) : quest.dueOn > today);
            return (
            <article className="companion-quest" key={quest.id}>
              <h3>{quest.title}</h3>
              {quest.description && <p>{quest.description}</p>}
              <p className="muted">{board.bond?.role === 'companion' ? companionStatusLabel(quest.status) : quest.status}{quest.dueOn ? ` · due ${quest.dueOn}` : ''}{quest.rewardText ? ` · reward: ${quest.rewardText}` : ''}</p>
              {board.bond?.role === 'inviter' && quest.status === 'accepted' && !future && (
                <button className="btn" type="button" disabled={busy} onClick={() => void run(async () => {
                  const { data, error } = await supabase().rpc('companion_complete_quest', { p_quest: quest.id });
                  fail(error);
                  const xp = Number((data as { xp_awarded?: number }).xp_awarded ?? 0);
                  setMessage(xp > 0 ? `Completed. +${xp} XP.` : 'Completed. No extra XP.');
                })}>Complete</button>
              )}
              {board.bond?.role === 'inviter' && quest.status === 'accepted' && future && (
                <p className="muted">Opens {quest.dueOn}</p>
              )}
            </article>
            );
          })}
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
      {board?.bond?.status === 'active' && (
        <CompanionHome board={board} busy={busy} reload={load} />
      )}
      {board?.bond?.status === 'active' && (
        <button className="btn ghost" type="button" onClick={() => board.bond?.role === 'companion' ? setShowTutorial(true) : setShowConnorTip(true)}>How it works</button>
      )}
      {message && <p className="message" role="status">{message}</p>}
      {showTutorial && (
        <Tutorial
          cards={[
            { title: 'Welcome', body: "You're Connor's companion in LIFE ASCENSION. His real-life quests power his hero." },
            { title: 'Send a quest', body: 'Type a task, add a note, and pick a day, like his off day. It lands straight on his board.' },
            { title: 'Watch progress', body: "You'll see it marked done when he finishes it, and he earns XP." },
            { title: 'Your first quest', body: 'Send a real one now. It lands on his board.' },
          ]}
          finishLabel="Send your first quest"
          lastCard={(
            <form onSubmit={(event) => {
              event.preventDefault();
              void run(async () => {
                const saved = await supabase().rpc('companion_set_identity', { p_name: name, p_title: title, p_color: color });
                fail(saved.error);
                const { error } = await supabase().rpc('companion_send_quest', {
                  p_title: questTitle,
                  p_description: '',
                  p_due: questDue || null,
                  p_reward: '',
                  p_cadence: questCadence,
                });
                fail(error);
                setQuestTitle('');
                rememberTutorial('izzy');
              });
            }}>
              <label htmlFor="tutorial-name">Your name</label>
              <input id="tutorial-name" className="field" maxLength={40} value={name} onChange={(event) => setName(event.target.value)} required />
              <label htmlFor="tutorial-title">Title</label>
              <select id="tutorial-title" className="field" value={title} onChange={(event) => setTitle(event.target.value)}>
                {COMPANION_TITLES.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <label htmlFor="tutorial-color">Quest color</label>
              <select id="tutorial-color" className="field" value={color} onChange={(event) => setColor(event.target.value)}>
                {COMPANION_COLORS.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <label htmlFor="tutorial-quest">First quest</label>
              <input id="tutorial-quest" className="field" maxLength={120} value={questTitle} onChange={(event) => setQuestTitle(event.target.value)} required />
              <button className="btn" type="submit" disabled={busy || !questTitle.trim() || !name.trim()}>Send your first quest</button>
            </form>
          )}
          onClose={() => rememberTutorial('izzy')}
          onFinish={() => rememberTutorial('izzy')}
        />
      )}
      {showConnorTip && (
        <Tutorial
          cards={[{ title: 'From Izzy', body: 'Quests from Izzy appear on your board automatically. You finish them like any other quest, and you earn the normal XP.' }]}
          finishLabel="Got it"
          onClose={() => rememberTutorial('connor')}
          onFinish={() => rememberTutorial('connor')}
        />
      )}
    </main>
  );
}
