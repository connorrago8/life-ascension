'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdventurerSprite } from '../AdventurerSprite';
import { PALETTE } from '../spriteArt';
import { GEAR_INKS, gearOverlays } from '../../lib/crypt/delve/gearArt';
import { PixelArt } from '../crypt/PixelArt';
import { SPRITES } from '../../lib/crypt/art';
import { HUB, PLAYER, PREVIEW_BANNER } from '../../lib/crypt/content';
import { WayfarerMark } from './WayfarerMark';
import { ACTIVE_RUN_KEY } from '../../lib/cryptActiveRun';

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
  // Keep ?preview=1 on the way in, and say "Continue run" when an unfinished run is waiting.
  const [entryHref, setEntryHref] = useState(CRYPT_ENTRY_HREF);
  const [hasRun, setHasRun] = useState(false);
  useEffect(() => {
    setEntryHref(cryptEntryHref(window.location.search));
    try {
      setHasRun(!!window.localStorage.getItem(ACTIVE_RUN_KEY));
    } catch {
      setHasRun(false);
    }
  }, []);

  function choose(location: (typeof HUB.locations)[number]) {
    setSelectedId(location.id);
    if (location.kind === 'preview') router.push(entryHref);
    if (location.kind === 'town') router.push('/play/emberhaven');
  }

  return (
    <main className="screen play-screen" data-screen="hub">
      <Link className="btn ghost" href="/" style={{ minHeight: 44, marginBottom: 12 }}>← Back to Home</Link>
      <div className="adv-brand">
        <div className="adv-logo" aria-hidden="true"><Star /></div>
        <p className="page-brand">LIFE ASCENSION</p>
      </div>
      <p className="preview-banner" role="status">{PREVIEW_BANNER}</p>
      <WayfarerMark />
      <h1>{HUB.title}</h1>
      <p className="lede">{HUB.lede}</p>

      <div className="adv-map">
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
              aria-pressed={location.id === selected.id}
              aria-label={locked ? `${location.name}, ${HUB.locked}` : location.kind === 'town' ? 'Town, open Emberhaven' : `${location.name}, ${HUB.preview}`}
              onClick={() => choose(location)}
            >
              <span className="adv-node-orb">
                <PixelArt rows={SPRITES[location.icon]} />
              </span>
              <span className="adv-node-name">{location.name}</span>
              {location.kind === 'town' ? <span className="soon-pill">Open</span> : location.kind === 'preview'
                ? <span className="soon-pill">{HUB.preview}</span>
                : <span className="adv-node-note">{HUB.locked}<span className="adv-node-soon">{HUB.soon}</span></span>}
            </button>
          );
        })}
        <div className="adv-hero">
          <AdventurerSprite label={PLAYER.name} overlays={STARTER_OVERLAYS} palette={HERO_PALETTE} />
        </div>
      </div>

      <p className="adv-blurb">{selected.blurb}</p>
      {selected.kind === 'preview' ? (
        <Link className="btn adv-enter" href={entryHref}>{hasRun ? 'Continue run' : HUB.enter}</Link>
      ) : selected.kind === 'town' ? (
        <Link className="btn adv-enter" href="/play/emberhaven">Visit Emberhaven town →</Link>
      ) : (
        <button type="button" className="btn adv-enter" disabled>{HUB.enter}</button>
      )}
      {selected.kind !== 'town' && <Link className="btn" href="/play/emberhaven" style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '100%', marginTop: 12 }}>
        Visit Emberhaven town →
      </Link>}
      <p className="play-note">{HUB.note}</p>
    </main>
  );
}
