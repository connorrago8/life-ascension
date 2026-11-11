'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PixelAvatar } from '../../../../components/PixelAvatar';
import { CompanionHero } from '../../../../components/companion/CompanionHero';
import { nextTierLabel, useCompanionWardrobe } from '../../../../components/companion/CompanionWardrobe';
import { questGlyph } from '../../../../lib/companionPass';
import { levelProgress } from '../../../../lib/level';
import { supabase } from '../../../../lib/supabase';
import { useCompanionBoard } from '../useCompanionBoard';

type HomeMetrics = { openQuests: number; doneThisWeek: number };

export default function CompanionModeHome() {
  const { board, ready, message } = useCompanionBoard();
  const { wardrobe, banner } = useCompanionWardrobe();
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
  const worn = (wardrobe?.items ?? []).filter((item) => item.worn).map((item) => item.id);
  const fraction = wardrobe ? levelProgress(wardrobe.xp) : 0;
  const upcoming = wardrobe ? nextTierLabel(wardrobe.items) : null;
  const recent = [...(board?.activities ?? [])].slice(0, 4);
  return (
    <main className="wrap companion-page companion-mode-home">
      <section className="cq-hero-card">
        <CompanionHero worn={worn} label={name} />
        <div>
          <p className="cq-kicker">Her home</p>
          <h1>Hello, {name}</h1>
          {title && <p className="muted">{title}</p>}
          {wardrobe && (
            <>
              <p className="cq-level-line">Level {wardrobe.level}</p>
              <div className="cq-heartbar" aria-label={`${wardrobe.xp} experience`}>
                <span style={{ width: `${Math.round(fraction * 100)}%` }} />
              </div>
            </>
          )}
          {upcoming && <p className="cq-next">Next: {upcoming}</p>}
        </div>
      </section>
      {banner.length > 0 && (
        <p className="companion-fanfare cq-sparkles" role="status">
          <i aria-hidden="true" /><i aria-hidden="true" /><i aria-hidden="true" /><i aria-hidden="true" />
          Unlocked: {banner.join(', ')} ♥
        </p>
      )}
      {board?.bond?.role === 'companion' && board.identity && (
        <section className="cq-bubble" aria-label="Hero greeting">
          <PixelAvatar who="connor" size={48} alt="Connor's hero, a pixel knight in silver armor" />
          <p>Connor&apos;s hero says hi, {board.identity.displayName}. ♥</p>
        </section>
      )}
      <div className="companion-metrics" aria-label="Quest metrics">
        <p className="companion-metric"><strong>{metrics ? metrics.openQuests : '…'}</strong><span>Open quests</span></p>
        <p className="companion-metric"><strong>{metrics ? metrics.doneThisWeek : '…'}</strong><span>Done this week</span></p>
      </div>
      {board?.recap?.visible && (
        <section className="companion-card" aria-label="Sunday recap">
          <h2>This week</h2>
          <p>{board.recap.done ?? 0} quests done. Streak {board.recap.streak ?? 0}. {board.recap.xp ?? 0} XP from those quests.</p>
        </section>
      )}
      <section className="companion-card" aria-label="Recent activity">
        <h2>Recent</h2>
        {recent.length === 0 && <p className="muted">Nothing new yet.</p>}
        <ul className="cq-timeline">
          {recent.map((item) => (
            <li key={item.id}><span aria-hidden="true">{questGlyph(item.title)}</span>{item.title}{item.voided ? ' · voided' : ''}</li>
          ))}
        </ul>
      </section>
      <Link className="btn companion-create" href="/companion/quests">Create quest</Link>
      {message && <p className="message" role="status">{message}</p>}
    </main>
  );
}
