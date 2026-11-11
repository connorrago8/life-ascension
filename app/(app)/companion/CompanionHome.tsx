'use client';

import { useState } from 'react';
import { PixelAvatar } from '../../../components/PixelAvatar';
import { collapseCompanionQuests, companionStatusLabel } from '../../../lib/companion';
import { fallbackQuestDrafts, type QuestCadence } from '../../../lib/companionQuestDraft';
import { gameDayParts, weekStart } from '../../../lib/questStreak';
import { supabase } from '../../../lib/supabase';

type Quest = {
  id: string;
  title: string;
  dueOn: string | null;
  status: string;
  cadence?: string | null;
  instanceId?: string | null;
  fromUser: string;
  nudgedToday?: boolean;
};
type Notice = { id: string; kind: string; questId: string | null; title: string | null; readAt: string | null };
type Reward = { id: string; text: string; goal: number; progress: number; unlocked: boolean };
type Repeat = { id: string; title: string; cadence: string; weekday: number; active: boolean };
type Milestone = { key: string; label: string; earned: boolean };
type Recap = { visible?: boolean; done?: number; streak?: number; xp?: number };

export type CompanionView = {
  userId: string;
  bond: { role: 'inviter' | 'companion'; partnerName?: string | null; partnerTitle?: string | null } | null;
  identity: { displayName: string; title: string; questColor?: string; avatarPath?: string | null } | null;
  quests: Quest[];
  activities?: { id: string; title: string; voided?: boolean }[];
  notices?: Notice[];
  rewards?: Reward[];
  repeats?: Repeat[];
  recap?: Recap;
  milestones?: Milestone[];
  tipsSeen?: string[];
};

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function CompanionHome({
  board,
  busy,
  reload,
}: {
  board: CompanionView;
  busy: boolean;
  reload: () => Promise<void>;
}) {
  const today = gameDayParts(new Date()).date;
  const start = weekStart(today);
  const end = addDays(start, 7);
  const mine = collapseCompanionQuests(board.quests.filter((quest) => quest.fromUser === board.userId && quest.status !== 'declined'));
  const inWeek = (quest: Quest) => !!quest.dueOn && quest.dueOn >= start && quest.dueOn < end;
  const groups = [
    ['Today, still open', mine.filter((quest) => quest.dueOn === today && quest.status !== 'completed')],
    ['Today, done', mine.filter((quest) => quest.dueOn === today && quest.status === 'completed')],
    ['This week, still open', mine.filter((quest) => inWeek(quest) && quest.dueOn !== today && quest.status !== 'completed')],
    ['This week, done', mine.filter((quest) => inWeek(quest) && quest.dueOn !== today && quest.status === 'completed')],
  ] as const;
  const [reward, setReward] = useState('');
  const [goal, setGoal] = useState('5');
  const [offDay, setOffDay] = useState(addDays(today, 1));
  const [offTitle, setOffTitle] = useState('');
  const [repeatTitle, setRepeatTitle] = useState('');
  const [repeatDay, setRepeatDay] = useState(2);
  const [repeatCadence, setRepeatCadence] = useState<QuestCadence>('daily');
  const [note, setNote] = useState('');
  const tips = new Set(board.tipsSeen ?? []);
  const izzy = board.bond?.role === 'companion';

  async function call(action: () => Promise<{ message: string } | null>) {
    const error = await action();
    setNote(error ? error.message : '');
    await reload();
  }

  function tip(key: string, text: string) {
    if (tips.has(key)) return null;
    return (
      <p className="companion-tip">
        {text}
        <button className="btn ghost" type="button" onClick={() => void call(async () => {
          const { error } = await supabase().rpc('companion_dismiss_tip', { p_key: key });
          return error;
        })}>Got it</button>
      </p>
    );
  }

  return (
    <>
      {izzy && board.identity && (
        <section className="panel companion-card companion-greeting">
          <PixelAvatar who="connor" size={72} alt="Connor's hero, a pixel knight in silver armor" />
          <p>Connor&apos;s hero greets you, {board.identity.displayName}, {board.identity.title}.</p>
        </section>
      )}
      {izzy && (
        <section className="panel companion-card" aria-label="Your quests for Connor">
          <h2>Your quests for Connor</h2>
          {tip('izzy-board', 'This list is only the quests you sent. His other quests stay private.')}
          {groups.map(([label, rows]) => (
            <div key={label}>
              <h3>{label}</h3>
              {rows.length === 0 && <p className="muted">None.</p>}
              {rows.map((quest) => (
                <div className="companion-quest" key={quest.id}>
                  <p>{quest.title}</p>
                  <p className="muted">{companionStatusLabel(quest.status)} · {quest.cadence === 'weekly' ? 'Weekly' : 'Daily'} · {quest.dueOn}</p>
                  {quest.status !== 'completed' && (
                    <button className="btn ghost" type="button" disabled={busy || quest.nudgedToday} onClick={() => void call(async () => {
                      const { error } = await supabase().rpc('companion_nudge', { p_quest: quest.id });
                      return error;
                    })}>{quest.nudgedToday ? 'Nudged today' : 'Nudge'}</button>
                  )}
                </div>
              ))}
            </div>
          ))}
        </section>
      )}
      {!izzy && tip('connor-board', 'Her quests show on your quest board in her color, with From Izzy. A Nudge badge means she checked in today.')}
      {!izzy && tip('connor-proof', 'After you finish one of her quests, you can add a photo. Only the two of you can open it.')}
      <section className="panel companion-card" aria-label="Notices">
        <h2>{izzy ? 'When he finishes one' : 'From Izzy'}</h2>
        {(board.notices ?? []).length === 0 && <p className="muted">Nothing new.</p>}
        {(board.notices ?? []).map((item) => (
          <div className="companion-quest" key={item.id}>
            {item.kind === 'completed' && <PixelAvatar who="izzy" size={40} alt="Izzy, smiling in her tiara" />}
            <p>{item.kind === 'thanks' ? `Thank you for ${item.title ?? 'that quest'}` : `${item.title ?? 'A quest'} is done`}</p>
            {izzy && item.kind === 'completed' && item.questId && (
              <button className="btn" type="button" disabled={busy} onClick={() => void call(async () => {
                const { error } = await supabase().rpc('companion_thank', { p_quest: item.questId });
                return error;
              })}>Thank you</button>
            )}
          </div>
        ))}
        {(board.notices ?? []).some((item) => !item.readAt) && (
          <button className="btn ghost" type="button" onClick={() => void call(async () => {
            const { error } = await supabase().rpc('companion_mark_notices_read');
            return error;
          })}>Mark read</button>
        )}
      </section>
      {board.recap?.visible && (
        <section className="panel companion-card companion-greeting" aria-label="Sunday recap">
          <PixelAvatar who="izzy" size={72} alt="Izzy, your companion" />
          <div>
            <h2>This week</h2>
            <p>{board.recap.done ?? 0} of her quests done. Streak {board.recap.streak ?? 0}. {board.recap.xp ?? 0} XP from those quests.</p>
          </div>
        </section>
      )}
      <section className="panel companion-card" aria-label="Milestones">
        <h2>Milestones</h2>
        <ul>
          {(board.milestones ?? []).map((item) => (
            <li key={item.key}>{item.earned ? item.label : `${item.label} — not yet`}</li>
          ))}
        </ul>
      </section>
      {izzy && (
        <>
          <section className="panel companion-card">
            <h2>A real-life reward</h2>
            <p className="muted">Text only. It never grants XP.</p>
            <form onSubmit={(event) => {
              event.preventDefault();
              void call(async () => {
                const { error } = await supabase().rpc('companion_set_reward', { p_text: reward, p_goal: Number(goal) });
                return error;
              });
            }}>
              <label htmlFor="reward-text">Reward</label>
              <input id="reward-text" className="field" maxLength={200} value={reward} onChange={(event) => setReward(event.target.value)} required />
              <label htmlFor="reward-goal">Quests this week</label>
              <input id="reward-goal" className="field" type="number" min={1} max={100} value={goal} onChange={(event) => setGoal(event.target.value)} />
              <button className="btn" type="submit" disabled={busy}>Save reward</button>
            </form>
            {(board.rewards ?? []).map((item) => (
              <p key={item.id}>{item.unlocked ? `Unlocked: ${item.text}` : `${item.progress} of ${item.goal}. ${item.text}`}</p>
            ))}
          </section>
          <section className="panel companion-card">
            <h2>Plan an off day</h2>
            {tip('izzy-planner', 'Pick a future day. The quest waits on his board until that game day.')}
            <form onSubmit={(event) => {
              event.preventDefault();
              void call(async () => {
                const cadence = fallbackQuestDrafts(offTitle)[0]?.cadence ?? 'daily';
                const { error } = await supabase().rpc('companion_send_quest', {
                  p_title: offTitle, p_description: '', p_due: offDay, p_reward: '', p_cadence: cadence,
                });
                if (!error) setOffTitle('');
                return error;
              });
            }}>
              <label htmlFor="off-day">Day</label>
              <input id="off-day" className="field" type="date" min={addDays(today, 1)} value={offDay} onChange={(event) => setOffDay(event.target.value)} required />
              <label htmlFor="off-title">Quest</label>
              <input id="off-title" className="field" maxLength={120} value={offTitle} onChange={(event) => setOffTitle(event.target.value)} required />
              <button className="btn" type="submit" disabled={busy}>Queue it</button>
            </form>
          </section>
          <section className="panel companion-card">
            <h2>Repeating chores</h2>
            <form onSubmit={(event) => {
              event.preventDefault();
              void call(async () => {
                const { error } = await supabase().rpc('companion_save_repeat', {
                  p_title: repeatTitle, p_note: '', p_weekday: repeatDay, p_cadence: repeatCadence,
                });
                if (!error) setRepeatTitle('');
                return error;
              });
            }}>
              <label htmlFor="repeat-title">Chore</label>
              <input id="repeat-title" className="field" maxLength={120} value={repeatTitle} onChange={(event) => {
                setRepeatTitle(event.target.value);
                setRepeatCadence(fallbackQuestDrafts(event.target.value)[0]?.cadence ?? 'daily');
              }} required />
              <label htmlFor="repeat-day">Day</label>
              <select id="repeat-day" className="field" value={repeatDay} onChange={(event) => setRepeatDay(Number(event.target.value))}>
                {DAYS.map((day, index) => <option key={day} value={index + 1}>{day}</option>)}
              </select>
              <button className="btn companion-chip" type="button" onClick={() => setRepeatCadence((value) => value === 'daily' ? 'weekly' : 'daily')}>
                {repeatCadence === 'weekly' ? 'Weekly' : 'Daily'}
              </button>
              <button className="btn" type="submit" disabled={busy}>Save repeat</button>
            </form>
            {(board.repeats ?? []).map((item) => (
              <div className="companion-quest" key={item.id}>
                <p>{item.title} · {DAYS[item.weekday - 1]} · {item.active ? item.cadence : 'paused'}</p>
                <button className="btn ghost" type="button" disabled={busy} onClick={() => void call(async () => {
                  const { error } = await supabase().rpc('companion_pause_repeat', { p_repeat: item.id, p_active: !item.active });
                  return error;
                })}>{item.active ? 'Pause' : 'Resume'}</button>
                <button className="btn ghost" type="button" disabled={busy} onClick={() => void call(async () => {
                  const { error } = await supabase().rpc('companion_delete_repeat', { p_repeat: item.id });
                  return error;
                })}>Delete</button>
              </div>
            ))}
          </section>
        </>
      )}
      {note && <p className="message" role="status">{note}</p>}
    </>
  );
}
