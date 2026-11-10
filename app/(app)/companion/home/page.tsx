'use client';

import Link from 'next/link';
import { PixelAvatar } from '../../../../components/PixelAvatar';
import { gameDayParts, weekStart } from '../../../../lib/questStreak';
import { useCompanionBoard } from '../useCompanionBoard';

function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export default function CompanionModeHome() {
  const { board, ready, message } = useCompanionBoard();
  if (!ready) return <main className="wrap companion-page"><p className="role-loading" role="status">Loading…</p></main>;
  const name = board?.identity?.displayName || 'Izzy';
  const title = board?.identity?.title;
  const mine = (board?.quests ?? []).filter((quest) => quest.fromUser === board?.userId && quest.status !== 'declined');
  const today = gameDayParts(new Date()).date;
  const start = weekStart(today);
  const end = addDays(start, 7);
  const open = mine.filter((quest) => quest.status !== 'completed').length;
  const doneThisWeek = mine.filter((quest) => quest.status === 'completed' && quest.dueOn && quest.dueOn >= start && quest.dueOn < end).length;
  const recent = [...(board?.activities ?? [])].slice(0, 2);
  return (
    <main className="wrap companion-page companion-mode-home">
      <section className="companion-greeting">
        <PixelAvatar who="izzy" size={72} alt="Izzy, a pixel princess with a silver tiara" />
        <div>
          <p className="eyebrow">Companion</p>
          <h1>Hello, {name}</h1>
          {title && <p className="muted">{title}</p>}
        </div>
      </section>
      <div className="companion-metrics" aria-label="Quest metrics">
        <p className="companion-metric"><strong>{open}</strong><span>Open quests</span></p>
        <p className="companion-metric"><strong>{doneThisWeek}</strong><span>Done this week</span></p>
      </div>
      <section aria-label="Recent activity">
        <h2>Recent</h2>
        {recent.length === 0 && <p className="muted">Nothing new yet.</p>}
        {recent.map((item) => (
          <p key={item.id}>{item.title}{item.voided ? ' · voided' : ''}</p>
        ))}
      </section>
      <Link className="btn companion-create" href="/companion/quests">Create quest</Link>
      {message && <p className="message" role="status">{message}</p>}
    </main>
  );
}
