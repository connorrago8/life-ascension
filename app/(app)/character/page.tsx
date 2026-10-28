'use client';

import { useCallback, useEffect, useState } from 'react';
import '../../preview/preview.css';
import { CharacterScreen } from '../../../components/preview/CharacterScreen';
import { attributeEntries, adventurerName } from '../../../lib/attributes';
import { ATTRIBUTE_PREVIEW } from '../../../lib/character';
import { levelFor, levelProgress } from '../../../lib/level';
import { verifiedLifetimeXp } from '../../../lib/characterXpProof';
import { supabase } from '../../../lib/supabase';
import { WELLNESS_EMPTY, wellnessSnapshot } from '../../../lib/wellness';

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
      const verifiedXp = verifiedLifetimeXp(xpResult.data);
      if (verifiedXp === null) {
        setState({ status: 'error', message: 'Could not verify lifetime XP. Your quests are unchanged.' });
        return;
      }
      const profile = profileResult.error ? null : (profileResult.data as Record<string, unknown> | null);
      setState({
        status: 'ready',
        name: adventurerName(user.email, profile?.display_name),
        xp: verifiedXp,
        profile,
        preview: false,
      });
    } catch {
      setState({ status: 'signed-out', loginHref: loginHref() });
    }
  }, []);

  useEffect(() => {
    void load();
    // Refresh verified XP when returning from the quest board or another tab.
    // Avoid stale level progress after a quest was completed elsewhere.
    const refreshOnFocus = () => { if (document.visibilityState === 'visible') void load(); };
    document.addEventListener('visibilitychange', refreshOnFocus);
    window.addEventListener('focus', refreshOnFocus);
    return () => {
      document.removeEventListener('visibilitychange', refreshOnFocus);
      window.removeEventListener('focus', refreshOnFocus);
    };
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
  const attributes = attributeEntries(state.profile);
  const pendingAttributes = attributes.some((attribute) => attribute.pending);
  const wellness = wellnessSnapshot(state.profile);

  return (
    <main className="screen character-screen">
      <p className="page-brand">LIFE ASCENSION</p>
      {state.preview && <p className="preview-banner" role="status">Layout preview with 2 lifetime XP. Sign in to load your character.</p>}
      <section className="panel" aria-label="Your character progress">
        <h1>{state.name}</h1>
        <p>Level {progress.level} · {progress.xpIntoLevel} / {progress.xpForNext} XP toward next level</p>
        <div className="xp-track" role="progressbar" aria-valuemin={0} aria-valuemax={progress.xpForNext} aria-valuenow={progress.xpIntoLevel} aria-label="Progress to next level"><span className="xp-fill" style={{ width: `${fraction * 100}%` }} /></div>
      </section>
      <p className="muted">Equipment below is a visual demo using starter items. Your real XP and attributes above and below are unchanged; equipment choices are not yet synced to your account.</p>
      <CharacterScreen displayName={state.name} hideSampleStats hideSampleLevel />
      <section className="panel" aria-label="Earn your next reward">
        <h2>Continue your adventure</h2>
        <p className="muted">Complete a real-world quest to earn verified XP. Equipment shown above is still a preview, not an earned account reward.</p>
        <a className="btn" href="/">Go to Quest Board</a>
      </section>
      <section className="stat-block" aria-label="Attributes">
        <div className="stat-grid">
          {attributes.map((attribute) => (
            <div key={attribute.key} className="stat">
              <span className="stat-label">{attribute.short}</span>
              <span className="stat-value" aria-label={attribute.pending ? `${attribute.label}, not recorded` : `${attribute.label} ${attribute.value}`}>
                {attribute.value}
              </span>
            </div>
          ))}
        </div>
        {pendingAttributes && (
          <p className="soon-note">
            Coming soon
            <span className="sr-only">. {ATTRIBUTE_PREVIEW}</span>
          </p>
        )}
      </section>

      <section className="wellness" id="wellness" aria-labelledby="wellness-heading">
        <h2 id="wellness-heading">Wellness</h2>
        {wellness.connected ? (
          <div className="wellness-readings">
            {wellness.sleepHours != null && <p>Sleep {formatReading(wellness.sleepHours)} h</p>}
            {wellness.steps != null && <p>Steps {formatReading(wellness.steps)}</p>}
          </div>
        ) : (
          <p className="wellness-empty">{WELLNESS_EMPTY}</p>
        )}
      </section>

    </main>
  );
}

function formatReading(value: number): string {
  return Number.isInteger(value) ? value.toLocaleString('en-US') : String(value);
}
