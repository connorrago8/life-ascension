'use client';

import { useCallback, useEffect, useState } from 'react';
import { ATTRIBUTES, ATTRIBUTE_PLACEHOLDER, adventurerName, attributeValue } from '../../../lib/attributes';
import {
  ADVENTURER_CLASS,
  ADVENTURER_TAGLINE,
  ATTRIBUTE_PREVIEW,
  CLASS_PATH_COPY,
  EQUIPMENT_PREVIEW,
} from '../../../lib/character';
import { coerceXp, levelFor, levelProgress } from '../../../lib/level';
import { supabase } from '../../../lib/supabase';
import { EquipSlot, SLOTS } from '../../../components/EquipSlot';

const LOCKS = ['Class unlocks', 'Equipment unlocks', 'Skill tree'];

type LoadState =
  | { status: 'loading' }
  | { status: 'signed-out'; loginHref: string }
  | { status: 'error'; message: string }
  | { status: 'ready'; name: string; xp: number; profile: Record<string, unknown> | null; preview: boolean };

function loginHref() {
  return '/login?next=%2Fcharacter';
}

export default function CharacterPage() {
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  const load = useCallback(async () => {
    const preview = process.env.NODE_ENV === 'development'
      && typeof window !== 'undefined'
      && new URLSearchParams(window.location.search).get('preview') === '1';
    if (preview) {
      setState({ status: 'ready', name: 'Adventurer', xp: 2, profile: null, preview: true });
      return;
    }
    try {
      const client = supabase();
      const { data: authData, error: authError } = await client.auth.getUser();
      const user = authError ? null : authData.user;
      if (!user) {
        setState({ status: 'signed-out', loginHref: loginHref() });
        return;
      }
      const [xpResult, profileResult] = await Promise.all([
        client.rpc('get_lifetime_xp'),
        client.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      ]);
      if (xpResult.error) {
        setState({ status: 'error', message: 'Could not read lifetime XP. Your quests are unchanged.' });
        return;
      }
      const profile = profileResult.error ? null : (profileResult.data as Record<string, unknown> | null);
      setState({
        status: 'ready',
        name: adventurerName(user.email, profile?.display_name),
        xp: coerceXp(xpResult.data),
        profile,
        preview: false,
      });
    } catch {
      setState({ status: 'signed-out', loginHref: loginHref() });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.status === 'loading') return <main className="wrap">Loading your character…</main>;
  if (state.status === 'signed-out') {
    return (
      <main className="wrap">
        <div className="eyebrow">LIFE ASCENSION</div>
        <h1>Your adventurer</h1>
        <p className="muted">Sign in to see your level, lifetime XP, and equipment.</p>
        <a className="btn" href={state.loginHref}>Sign in</a>
      </main>
    );
  }
  if (state.status === 'error') {
    return (
      <main className="wrap">
        <div className="eyebrow">LIFE ASCENSION</div>
        <h1>Your adventurer</h1>
        <p className="message" role="status">{state.message}</p>
        <button type="button" className="btn" onClick={() => { setState({ status: 'loading' }); void load(); }}>Try again</button>
      </main>
    );
  }

  const progress = levelFor(state.xp);
  const fraction = levelProgress(state.xp);
  const left = SLOTS.filter((slot) => slot.side === 'left');
  const right = SLOTS.filter((slot) => slot.side === 'right');

  return (
    <main className="character-screen">
      <section className="doll-stage" aria-label="Adventurer">
        {state.preview && <p className="preview-banner" role="status">Layout preview with 2 lifetime XP. Sign in to load your character.</p>}
        <header className="doll-head">
          <h1>YOUR ADVENTURER</h1>
          <p>{ADVENTURER_TAGLINE}</p>
        </header>
        <div className="paper-doll">
          <div className="slot-col">
            {left.map((slot) => <EquipSlot key={slot.key} slot={slot} />)}
          </div>
          <div className="sprite-well">
            <img
              className="adventurer-sprite pixelated"
              src="/character/sprite.png"
              alt={`${state.name}, level ${progress.level} ${ADVENTURER_CLASS}`}
              width={96}
              height={128}
            />
          </div>
          <div className="slot-col">
            {right.map((slot) => <EquipSlot key={slot.key} slot={slot} />)}
          </div>
        </div>
        <p className="cosmetic-note">{EQUIPMENT_PREVIEW}</p>
      </section>

      <aside className="character-card" aria-label="Level and attributes">
        <p className="adventurer-name">{state.name}</p>
        <h2 className="level-title">Level {progress.level}</h2>
        <p className="class-name">{ADVENTURER_CLASS}</p>
        <div
          className="xp-track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={progress.xpForNext}
          aria-valuenow={progress.xpIntoLevel}
          aria-label="Progress to next level"
        >
          <span className="xp-fill" style={{ width: `${fraction * 100}%` }} />
        </div>
        <p className="xp-fraction">{progress.xpIntoLevel} / {progress.xpForNext} XP</p>
        <p className="muted lifetime">{state.xp} lifetime XP</p>
        {/* Unlabeled room for two future resources. No names or values until they exist. */}
        <div className="resource-reserve" aria-hidden="true">
          <div className="resource-reserve-cell" />
          <div className="resource-reserve-cell" />
        </div>
        <p className="class-copy">{CLASS_PATH_COPY}</p>

        <h3 className="section-label">Attributes</h3>
        <div className="attributes">
          {ATTRIBUTES.map((attribute) => {
            const value = attributeValue(state.profile, attribute.key);
            const recorded = value !== ATTRIBUTE_PLACEHOLDER;
            return (
              <div key={attribute.key} className="attribute">
                <span className="attr-name">
                  <span className="attr-full">{attribute.label}</span>
                  <span className="attr-short">{attribute.short}</span>
                </span>
                <span className="attr-value" aria-label={recorded ? undefined : `${attribute.label}, not recorded`}>{value}</span>
              </div>
            );
          })}
        </div>
        <p className="muted attr-note">{ATTRIBUTE_PREVIEW}</p>
        <ul className="locks">
          {LOCKS.map((label) => (
            <li key={label} className="lock-chip">Locked · {label}</li>
          ))}
        </ul>
      </aside>
    </main>
  );
}
