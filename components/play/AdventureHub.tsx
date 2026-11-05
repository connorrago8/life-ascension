'use client';

import { ModeLink as Link } from '../ModeLink';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdventurerSprite } from '../AdventurerSprite';
import { PALETTE } from '../spriteArt';
import { GEAR_INKS, gearOverlays } from '../../lib/crypt/delve/gearArt';
import { PixelArt } from '../crypt/PixelArt';
import { SPRITES } from '../../lib/crypt/art';
import { HUB, PLAYER } from '../../lib/crypt/content';
import { InAppBackLink } from '../InAppBackLink';
import { WayfarerMark } from './WayfarerMark';
import { ACTIVE_RUN_KEY, browserStorage } from '../../lib/cryptActiveRun';
import { navigationModeHref } from '../../lib/navigationMode';
import { hubCryptContinuation } from '../../lib/cryptHubEntry';

// Default Rusty Sword / Rusty Armor (0 stats) on the hero sprite.
const STARTER_OVERLAYS = gearOverlays({});
const HERO_PALETTE = { ...PALETTE, ...GEAR_INKS };

/**
 * Every Forgotten Crypt entry opens the playable delve (Room 1 of 12, path
 * choices, five-stat card combat). The legacy /play/crypt prologue is no longer
 * linked from the map; it stays reachable only for its existing browser QA.
 */
export const CRYPT_ENTRY_HREF = '/play/delve';

/** The delve link, keeping guest/dev preview mode (?preview=1) so the same run resumes. */
export function cryptEntryHref(search: string): string {
  return new URLSearchParams(search).get('preview') === '1' ? `${CRYPT_ENTRY_HREF}?preview=1` : CRYPT_ENTRY_HREF;
}

function Star() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M12 2.2 14.1 9h7.1l-5.7 4.2 2.2 6.8L12 15.8 6.3 20l2.2-6.8L2.8 9h7.1z" />
    </svg>
  );
}

export function AdventureHub() {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(HUB.locations[0].id);
  const selected = HUB.locations.find((location) => location.id === selectedId) ?? HUB.locations[0];
  // Promise continuation only when the same loader accepts this known owner/mode.
  const [entryHref, setEntryHref] = useState(CRYPT_ENTRY_HREF);
  const [hasRun, setHasRun] = useState(false);
  useEffect(() => {
    function refreshEntry() {
      setEntryHref(cryptEntryHref(window.location.search));
      setHasRun(hubCryptContinuation(
        browserStorage(), window.location.search,
        process.env.NODE_ENV === 'development',
        !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
        Date.now(),
      ));
    }
    function storageChanged(event: StorageEvent) {
      if (event.key === null || event.key === ACTIVE_RUN_KEY) refreshEntry();
    }
    refreshEntry();
    window.addEventListener('focus', refreshEntry);
    window.addEventListener('pageshow', refreshEntry);
    window.addEventListener('storage', storageChanged);
    return () => {
      window.removeEventListener('focus', refreshEntry);
      window.removeEventListener('pageshow', refreshEntry);
      window.removeEventListener('storage', storageChanged);
    };
  }, []);

  function choose(location: (typeof HUB.locations)[number]) {
    setSelectedId(location.id);
    if (location.kind === 'preview') router.push(cryptEntryHref(window.location.search));
    if (location.kind === 'town') router.push(navigationModeHref('/play/emberhaven', window.location.search, process.env.NODE_ENV === 'development'));
  }

  return (
    <main className="screen play-screen" data-screen="hub">
      <InAppBackLink className="btn ghost" href="/" style={{ minHeight: 44, marginBottom: 12 }}>← Back to Home</InAppBackLink>
      <div className="adv-brand">
        <div className="adv-logo" aria-hidden="true"><Star /></div>
        <p className="page-brand">LIFE ASCENSION</p>
      </div>
      <WayfarerMark />
      <h1>{HUB.title}</h1>
      <p className="lede">{HUB.lede}</p>

      <div className="adv-map" role="group" aria-label="Adventure destinations">
        <svg className="adv-web" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {HUB.links.map(([from, to]) => {
            const start = HUB.locations.find((location) => location.id === from);
            const end = HUB.locations.find((location) => location.id === to);
            if (!start || !end) return null;
            return <line key={`${from}-${to}`} x1={start.x} y1={start.y} x2={end.x} y2={end.y} />;
          })}
        </svg>
        {HUB.locations.map((location) => {
          const locked = location.kind === 'locked';
          return (
            <button
              key={location.id}
              type="button"
              className={locked ? 'adv-node is-locked' : 'adv-node is-preview'}
              style={{ left: `${location.x}%`, top: `${location.y}%` }}
              aria-pressed={locked ? location.id === selected.id : undefined}
              aria-label={locked ? `${location.name}, ${HUB.locked}` : location.kind === 'town' ? 'Town, open Emberhaven' : `Open ${location.name} preview`}
              onClick={() => choose(location)}
            >
              <span className="adv-node-orb" aria-hidden="true">
                <PixelArt rows={SPRITES[location.icon]} />
              </span>
              <span className="adv-node-name">{location.name}</span>
              {location.kind === 'town' ? <span className="soon-pill">Open</span> : location.kind === 'preview'
                ? <span className="soon-pill">{HUB.preview}</span>
                : <span className="adv-node-note">Locked. Coming soon.</span>}
            </button>
          );
        })}
        <div className="adv-hero" aria-hidden="true">
          <AdventurerSprite label={PLAYER.name} overlays={STARTER_OVERLAYS} palette={HERO_PALETTE} />
        </div>
      </div>

      <p className="adv-blurb">{selected.blurb}</p>
      {selected.kind === 'preview' ? (
        <>
          <p className="preview-banner" role="status">Crypt preview: earns no XP.</p>
          <Link className="btn adv-enter" href={entryHref}>{hasRun ? 'Continue run' : HUB.enter}</Link>
        </>
      ) : selected.kind === 'town' ? (
        <Link className="btn adv-enter" href="/play/emberhaven">Visit Emberhaven town →</Link>
      ) : (
        <button type="button" className="btn adv-enter" disabled>{HUB.enter}</button>
      )}
      {selected.kind !== 'town' && <Link className="btn" href="/play/emberhaven" style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '100%', marginTop: 12 }}>
        Visit Emberhaven town →
      </Link>}
      <article className="lock-card" aria-label="Brain Rot">
        <p className="lock-kicker">Arcade dungeon</p>
        <h2>Brain Rot</h2>
        <p className="muted">Ten mini-games across 30 levels, then the Brain Rot King. Your quest XP is not spent here.</p>
        <Link className="btn" href="/play/brain-rot" style={{ minHeight: 44 }}>Enter Brain Rot</Link>
      </article>
      <p className="play-note">{HUB.note}</p>
    </main>
  );
}
