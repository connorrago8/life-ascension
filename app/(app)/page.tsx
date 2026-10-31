'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { HomeCharacter } from '../../components/preview/HomeCharacter';
import { homeCharacterModel } from '../../lib/preview/characterRender';
import { appearanceFromLoadout } from '../../lib/preview/appearance';
import { catalogItem } from '../../lib/preview/catalog';
import { characterGearView, parseAuthenticatedGearSnapshot, type AuthenticatedGearSnapshot } from '../../lib/preview/characterGearView';
import { attributeEntries, adventurerName } from '../../lib/attributes';
import { parseCryptProfile } from '../../lib/cryptVault';
import { ADVENTURER_CLASS } from '../../lib/character';
import { levelFor, levelProgress } from '../../lib/level';
import { verifiedLifetimeXp } from '../../lib/characterXpProof';
import { GEAR_SLOTS, SERVER_EQUIPPABLE_ITEMS } from '../../lib/gearSlots';
import { chicagoToday, todayGlance, todayGlanceLabel, type GlanceInstance, type GlanceQuest, type TodayGlance } from '../../lib/homeToday';
import { supabase } from '../../lib/supabase';
import { localParts, parseStreak, type StreakState } from '../../lib/questStreak';
import { starterSlots } from '../../lib/starterLook';
import { ReturnBanner } from '../../components/home/ReturnBanner';

type HomeState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'error'; message: string }
  | {
      status: 'ready';
      name: string;
      xp: number;
      stats: Record<string, unknown> | null;
      gear: AuthenticatedGearSnapshot | null;
      today: TodayGlance | null;
      streak: StreakState | null;
      preview: boolean;
    };

const FALLBACK_APPEARANCE = appearanceFromLoadout({ equipmentIds: [] });

/**
 * Home: a read-only, character-first screen. Quests are completed on /quests;
 * Home never creates instances, awards XP, or equips gear. Navigation lives in
 * the bottom nav, so this screen adds no duplicate "go to" buttons.
 */
export default function Home() {
  const [state, setState] = useState<HomeState>({ status: 'loading' });
  const loadSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    const commit = (next: HomeState) => { if (seq === loadSeq.current) setState(next); };
    const preview = process.env.NODE_ENV === 'development'
      && typeof window !== 'undefined'
      && new URLSearchParams(window.location.search).get('preview') === '1';
    if (preview) {
      commit({ status: 'ready', name: 'Adventurer', xp: 7, stats: { strength: 3, agility: 2, intelligence: 1, endurance: 2, luck: 1 }, gear: null, today: { left: 2, done: 1 }, streak: { fire: 7, doneToday: true, today: chicagoToday(), timeZone: 'America/Chicago' }, preview: true });
      return;
    }
    try {
      const client = supabase();
      const { data: authData, error: authError } = await client.auth.getUser();
      const user = authError ? null : authData.user;
      if (!user) { commit({ status: 'signed-out' }); return; }
      const today = chicagoToday();
      const [xpResult, profileResult, gearResult, statsResult, questsResult, instancesResult, streakResult] = await Promise.all([
        client.rpc('get_lifetime_xp'),
        client.from('profiles').select('display_name').eq('id', user.id).maybeSingle(),
        client.rpc('get_earned_gear'),
        client.rpc('get_crypt_profile'),
        client.from('quests').select('id,cadence,quest_type,scheduled_for').eq('active', true).limit(1000),
        client.from('quest_instances').select('quest_id,due_date,status').eq('owner_id', user.id).lte('due_date', today).or(`status.eq.available,due_date.eq.${today}`).limit(1000),
        // Optional: a database without get_quest_streak just hides the badge.
        Promise.resolve(client.rpc('get_quest_streak')).catch(() => ({ data: null, error: true })),
      ]);
      const verifiedXp = xpResult.error ? null : verifiedLifetimeXp(xpResult.data);
      if (verifiedXp === null) {
        commit({ status: 'error', message: 'Could not verify lifetime XP. Your quests are unchanged.' });
        return;
      }
      const profile = profileResult.error ? null : (profileResult.data as Record<string, unknown> | null);
      const glance = questsResult.error || instancesResult.error
        ? null
        : todayGlance((questsResult.data ?? []) as GlanceQuest[], (instancesResult.data ?? []) as GlanceInstance[], today, { userId: user.id, minutesOfDay: localParts(new Date()).minutes });
      commit({
        status: 'ready',
        name: adventurerName(user.email, profile?.display_name),
        xp: verifiedXp,
        stats: statsResult.error ? null : parseCryptProfile(statsResult.data).attributes,
        gear: gearResult.error ? null : parseAuthenticatedGearSnapshot(gearResult.data),
        today: glance,
        streak: streakResult.error ? null : parseStreak(streakResult.data),
        preview: false,
      });
    } catch {
      commit({ status: 'error', message: 'Could not load your adventurer. Your quests are unchanged.' });
    }
  }, []);

  useEffect(() => {
    void load();
    const refresh = () => { if (document.visibilityState === 'visible') void load(); };
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
      loadSeq.current += 1;
    };
  }, [load]);

  if (state.status === 'loading') return <main className="wrap home-hub" aria-busy="true"><p className="muted">Loading your adventurer…</p></main>;
  if (state.status === 'signed-out') {
    return (
      <main className="wrap home-hub">
        <ReturnBanner />
        <div className="eyebrow">LIFE ASCENSION</div>
        <h1>Your adventure awaits</h1>
        <p className="muted">Real actions. Real progress. Your private quest journal.</p>
        <a className="btn" href="/login?next=%2F">Sign in</a>
      </main>
    );
  }
  if (state.status === 'error') {
    return (
      <main className="wrap home-hub">
        <div className="eyebrow">LIFE ASCENSION</div>
        <p className="message" role="status">{state.message}</p>
        <button type="button" className="btn ghost" onClick={() => { setState({ status: 'loading' }); void load(); }}>Try again</button>
      </main>
    );
  }

  const progress = levelFor(state.xp);
  const fraction = levelProgress(state.xp);
  const attributes = attributeEntries(state.stats);
  const gearView = characterGearView(state.gear ? 'verified' : 'unverified', FALLBACK_APPEARANCE, state.gear);
  const model = homeCharacterModel({ ...gearView.appearance, name: state.name });
  const equipped = (state.gear?.equippedItemIds ?? [])
    .filter((id) => SERVER_EQUIPPABLE_ITEMS[id])
    .map((id) => ({ id, key: SERVER_EQUIPPABLE_ITEMS[id] as string, name: catalogItem(id)?.name ?? id, slot: GEAR_SLOTS.find((slot) => slot.key === SERVER_EQUIPPABLE_ITEMS[id])?.label ?? '' }));
  // Empty Weapon/Armor slots wear the default Rusty Sword / Rusty Armor (0 stats).
  const starter = starterSlots({ armor: equipped.some((item) => item.key === 'armor'), weapon: equipped.some((item) => item.key === 'weapon') });
  const worn = [
    ...[starter.weapon, starter.armor].flatMap((item) => (item ? [{ id: item.id, key: item.slot as string, name: item.name, slot: item.slotLabel }] : [])),
    ...equipped,
  ];

  return (
    <main className="wrap home-hub">
      {state.preview && <p className="preview-banner" role="status">Layout preview. Sign in to load your adventurer.</p>}
      <ReturnBanner />
      <header className="hub-header">
        <div className="eyebrow">LIFE ASCENSION</div>
        <h1 className="hub-name">{state.name}</h1>
        <p className="hub-class">{ADVENTURER_CLASS}</p>
      </header>

      <section className="hub-stage" aria-label="Your adventurer">
        <div className="hub-stage-glow" aria-hidden="true" />
        <HomeCharacter model={model} idPrefix="hub" beltPreviewStage={gearView.beltStage} />
      </section>

      <section className="hub-level" aria-label="Level and XP">
        <div className="hub-level-row">
          <span className="hub-level-badge">Lv {progress.level}</span>
          <span className="hub-level-xp">{progress.xpIntoLevel} / {progress.xpForNext} XP</span>
        </div>
        <div className="hub-xp-track" role="progressbar" aria-valuemin={0} aria-valuemax={progress.xpForNext} aria-valuenow={progress.xpIntoLevel}
          aria-label={`Level ${progress.level}: ${progress.xpIntoLevel} of ${progress.xpForNext} XP to next level`}>
          <span className="hub-xp-fill" style={{ width: `${fraction * 100}%` }} />
        </div>
        <p className="hub-lifetime muted">{state.xp} lifetime XP</p>
      </section>

      <section className="hub-card hub-summary" aria-label="Adventurer summary">
        <ul className="hub-stats" aria-label="Stats">
          {attributes.map((attribute) => (
            <li key={attribute.key} className="hub-stat" aria-label={attribute.pending ? `${attribute.label}, not set` : `${attribute.label} ${attribute.value}`}>
              <span className="hub-stat-label" aria-hidden="true">{attribute.short}</span>
              <span className="hub-stat-value" aria-hidden="true">{attribute.value}</span>
            </li>
          ))}
        </ul>
        <div className="hub-gear" aria-label="Equipped gear">
          <span className="hub-gear-label">Gear</span>
          {state.gear === null && !state.preview ? (
            <span className="hub-gear-empty">Unavailable right now</span>
          ) : (
            <span className="hub-gear-items">{worn.map((item) => <span key={item.id} className="hub-gear-chip">{item.name}{item.slot ? <small> · {item.slot}</small> : null}</span>)}</span>
          )}
        </div>
      </section>

      {state.today && (
        <Link href="/quests" className="hub-card hub-today" aria-label={`Today: ${todayGlanceLabel(state.today)}.${state.streak ? ` Streak ${state.streak.fire} days.` : ''} Open quests`}>
          <span className="hub-today-label">Today</span>
          <span className="hub-today-value">{todayGlanceLabel(state.today)}</span>
          {state.streak && <span className={'hub-streak' + (state.streak.fire > 0 ? ' lit' : '')} aria-hidden="true">🔥 {state.streak.fire}</span>}
          <span className="hub-today-chevron" aria-hidden="true">›</span>
        </Link>
      )}
    </main>
  );
}
