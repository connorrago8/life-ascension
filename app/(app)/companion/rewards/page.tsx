'use client';

import { useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useCompanionBoard } from '../useCompanionBoard';

export default function CompanionRewardsPage() {
  const { board, ready, message, setMessage, reload } = useCompanionBoard();
  const [text, setText] = useState('');
  const [goal, setGoal] = useState('5');
  const [busy, setBusy] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    const { error } = await supabase().rpc('companion_set_reward', { p_text: text, p_goal: Number(goal) });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setText('');
    await reload();
  }

  if (!ready) return <main className="wrap companion-page"><p className="role-loading" role="status">Loading…</p></main>;
  return (
    <main className="wrap companion-page">
      <h1>Rewards</h1>
      <p className="muted">A real-life treat. It never grants XP.</p>
      <form className="companion-card" onSubmit={(event) => void save(event)}>
        <label htmlFor="reward-text">Reward</label>
        <input id="reward-text" className="field" maxLength={200} value={text} onChange={(event) => setText(event.target.value)} required />
        <label htmlFor="reward-goal">Quests this week</label>
        <input id="reward-goal" className="field" type="number" min={1} max={100} value={goal} onChange={(event) => setGoal(event.target.value)} />
        <button className="btn" type="submit" disabled={busy}>Save reward</button>
      </form>
      <ul className="cq-list">
        {(board?.rewards ?? []).map((item) => {
          const filled = Math.max(0, Math.min(item.goal, item.progress));
          const meter = `${'▮'.repeat(filled)}${'▯'.repeat(Math.max(0, item.goal - filled))}`;
          return (
            <li key={item.id} className={item.unlocked ? 'cq-card is-done' : 'cq-card is-open'}>
              <div className="cq-card-main">
                <p className="cq-title">{item.text}</p>
                <p className="cq-meter" aria-label={`${item.progress} of ${item.goal}`}>{meter}</p>
                <span className={item.unlocked ? 'cq-pill is-done' : 'cq-pill'}>{item.unlocked ? 'Unlocked' : `${item.progress} of ${item.goal}`}</span>
              </div>
            </li>
          );
        })}
      </ul>
      {message && <p className="message" role="status">{message}</p>}
    </main>
  );
}
