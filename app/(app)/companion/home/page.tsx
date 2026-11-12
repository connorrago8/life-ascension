'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CompanionHero } from '../../../../components/companion/CompanionHero';
import { useCompanionWardrobe } from '../../../../components/companion/CompanionWardrobe';
import { CosmeticLevelUp } from '../../../../components/CosmeticLevelUp';
import { PASS_TIERS } from '../../../../lib/companionPass';
import { cosmeticTitle } from '../../../../lib/levelTitles';
import { nextEvenUnlock } from '../../../../lib/levelUpCopy';
import { levelProgress } from '../../../../lib/level';
import { gameDayParts } from '../../../../lib/questStreak';
import { supabase } from '../../../../lib/supabase';
import { useCompanionBoard } from '../useCompanionBoard';

export default function CompanionModeHome() {
  const { board, ready, message, reload } = useCompanionBoard();
  const { wardrobe, banner } = useCompanionWardrobe();
  const [openQuests, setOpenQuests] = useState<number | null>(null);
  const [levelUp, setLevelUp] = useState<{ level: number; item: { id: string; label: string } | null } | null>(null);
  useEffect(() => {
    if (!ready || !board) return;
    let cancel = false;
    void supabase().rpc('companion_home_metrics').then(({ data, error }) => {
      if (cancel || error || !data) return;
      const metrics = data as { openQuests?: number };
      setOpenQuests(typeof metrics.openQuests === 'number' ? metrics.openQuests : null);
    });
    return () => { cancel = true; };
  }, [ready, board]);
  useEffect(() => {
    if (!wardrobe || typeof window === 'undefined') return;
    const key = 'la.cosmetic-level.izzy';
    const stored = window.sessionStorage.getItem(key);
    const previous = stored == null ? null : Number(stored);
    if (previous == null || !Number.isFinite(previous)) {
      window.sessionStorage.setItem(key, String(wardrobe.level));
      return;
    }
    if (wardrobe.level > previous) {
      const unlocked = PASS_TIERS.find((item) => item.grantKind === 'level' && item.unlockLevel === wardrobe.level);
      setLevelUp({
        level: wardrobe.level,
        item: unlocked ? { id: unlocked.id, label: unlocked.label } : null,
      });
      window.sessionStorage.setItem(key, String(wardrobe.level));
    }
  }, [wardrobe]);
  if (!ready) return <main className="wrap companion-page"><p className="role-loading" role="status">Gathering your story…</p></main>;
  const name = board?.identity?.displayName || 'Izzy';
  const title = board?.identity?.title;
  const worn = (wardrobe?.items ?? []).filter((item) => item.worn).map((item) => item.id);
  const fraction = wardrobe ? levelProgress(wardrobe.xp) : 0;
  const nextLevel = wardrobe ? nextEvenUnlock(wardrobe.level) : null;
  const today = gameDayParts(new Date()).date;
  const activities = (board?.activities ?? []).filter((item) => !item.voided);
  const todayCount = activities.filter((item) => item.createdAt && gameDayParts(new Date(item.createdAt)).date === today).length;
  const last = activities[0] ?? null;
  const openQuest = (board?.quests ?? []).find((row) => row.status !== 'completed' && row.status !== 'declined');
  const loadFailed = Boolean(message && message.startsWith("Couldn't load"));
  return (
    <main className="wrap companion-page companion-mode-home">
      <section className="cq-hero-card">
        <CompanionHero worn={worn} label={name} />
        <div>
          <p className="cq-kicker">{title || 'Companion'}</p>
          <h1>{name}</h1>
          {wardrobe && (
            <>
              <p className="cq-level-line">Level {wardrobe.level}</p>
              <p className="cq-title-line">{cosmeticTitle(wardrobe.level, 'izzy')}</p>
              <p className="muted">{wardrobe.xp} XP</p>
              <div className="cq-xpbar" aria-label={`${wardrobe.xp} experience`}>
                <span style={{ width: `${Math.round(fraction * 100)}%` }} />
              </div>
            </>
          )}
        </div>
      </section>
      <Link className="btn companion-create" href="/companion/log">Log activity</Link>
      <p className="cq-level-line">{todayCount} logged today</p>
      {last ? (
        <p><Link href={`/companion/history?entry=${last.id}`}>{last.title}</Link></p>
      ) : (
        <p className="empty-state">Your next chapter begins with one small thing.</p>
      )}
      {nextLevel != null && (
        <p className="cq-next"><Link href="/companion/character">Your next unlock is at Level {nextLevel}.</Link></p>
      )}
      {openQuest && (
        <p><Link href="/companion/quests">{openQuest.title}</Link>{openQuests != null ? ` · ${openQuests} open` : ''}</p>
      )}
      {banner.length > 0 && (
        <p className="companion-fanfare" role="status">New gear unlocked: {banner.join(', ')}.</p>
      )}
      {levelUp && (
        <CosmeticLevelUp
          who="izzy"
          level={levelUp.level}
          item={levelUp.item}
          characterHref="/companion/character"
          onClose={() => setLevelUp(null)}
        />
      )}
      {loadFailed && (
        <p className="message" role="status">
          Home couldn't load. Your saved progress is unchanged.{' '}
          <button className="btn ghost" type="button" onClick={() => void reload()}>Try again</button>
        </p>
      )}
    </main>
  );
}
