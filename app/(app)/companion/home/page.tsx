'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PixelAvatar } from '../../../../components/PixelAvatar';
import { supabase } from '../../../../lib/supabase';
import { useCompanionBoard } from '../useCompanionBoard';

type HomeMetrics = { openQuests: number; doneThisWeek: number };

export default function CompanionModeHome() {
  const { board, ready, message } = useCompanionBoard();
  const [metrics, setMetrics] = useState<HomeMetrics | null>(null);
  useEffect(() => {
    if (!ready || !board) return;
    let cancel = false;
    void supabase().rpc('companion_home_metrics').then(({ data, error }) => {
      if (cancel || error || !data) return;
      setMetrics(data as HomeMetrics);
    });
    return () => { cancel = true; };
  }, [ready, board]);
  if (!ready) return <main className="wrap companion-page"><p className="role-loading" role="status">Loading…</p></main>;
  const name = board?.identity?.displayName || 'Izzy';
  const title = board?.identity?.title;
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
      {board?.bond?.role === 'companion' && board.identity && (
        <section className="companion-greeting" aria-label="Hero greeting">
          <PixelAvatar who="connor" size={72} alt="Connor's hero, a pixel knight in silver armor" />
          <p>Connor&apos;s hero greets you, {board.identity.displayName}, {board.identity.title}.</p>
        </section>
      )}
      <div className="companion-metrics" aria-label="Quest metrics">
        <p className="companion-metric"><strong>{metrics ? metrics.openQuests : '…'}</strong><span>Open quests</span></p>
        <p className="companion-metric"><strong>{metrics ? metrics.doneThisWeek : '…'}</strong><span>Done this week</span></p>
      </div>
      {board?.recap?.visible && (
        <section aria-label="Sunday recap">
          <h2>This week</h2>
          <p>{board.recap.done ?? 0} quests done. Streak {board.recap.streak ?? 0}. {board.recap.xp ?? 0} XP from those quests.</p>
        </section>
      )}
      {(board?.milestones ?? []).length > 0 && (
        <section aria-label="Milestones">
          <h2>Milestones</h2>
          <ul>
            {board?.milestones?.map((item) => (
              <li key={item.key}>{item.earned ? item.label : `${item.label} — not yet`}</li>
            ))}
          </ul>
        </section>
      )}
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
