'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import '../../preview/preview.css';
import { CharacterScreen } from '../../../components/preview/CharacterScreen';
import { attributeEntries, adventurerName } from '../../../lib/attributes';
import { ATTRIBUTE_PREVIEW } from '../../../lib/character';
import { levelFor, levelProgress } from '../../../lib/level';
import { verifiedLifetimeXp } from '../../../lib/characterXpProof';
import { createLatestCharacterLoadGate } from '../../../lib/preview/latestCharacterLoadGate';
import { supabase } from '../../../lib/supabase';
import { parseAuthenticatedGearSnapshot, type AuthenticatedGearSnapshot } from '../../../lib/preview/characterGearView';
import { WELLNESS_EMPTY, wellnessSnapshot } from '../../../lib/wellness';

type LoadState =
  | { status: 'loading' }
  | { status: 'signed-out'; loginHref: string }
  | { status: 'error'; message: string }
  | { status: 'ready'; name: string; xp: number; profile: Record<string, unknown> | null; preview: boolean; gear: AuthenticatedGearSnapshot | null };

function loginHref() {
  return '/login?next=%2Fcharacter';
}

export default function CharacterPage() {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [equipmentBusy, setEquipmentBusy] = useState(false);
  const [equipmentError, setEquipmentError] = useState('');
  const loadGate = useRef(createLatestCharacterLoadGate());
  const equipmentMutationInFlight = useRef(false);

  const load = useCallback(async () => {
    // Focus/visibility refreshes and post-equip reads may overlap. Only the
    // latest request may commit a verified XP/equipment snapshot or error.
    const isCurrent = loadGate.current.begin();
    const commit = (next: LoadState) => { if (isCurrent()) setState(next); };
    const preview = process.env.NODE_ENV === 'development'
      && typeof window !== 'undefined'
      && new URLSearchParams(window.location.search).get('preview') === '1';
    if (preview) {
      commit({ status: 'ready', name: 'Adventurer', xp: 2, profile: null, preview: true, gear: null });
      return;
    }
    try {
      const client = supabase();
      const { data: authData, error: authError } = await client.auth.getUser();
      const user = authError ? null : authData.user;
      if (!user) {
        commit({ status: 'signed-out', loginHref: loginHref() });
        return;
      }
      const [xpResult, profileResult, gearResult] = await Promise.all([
        client.rpc('get_lifetime_xp'),
        client.from('profiles').select('*').eq('id', user.id).maybeSingle(),
        client.rpc('get_earned_gear'),
      ]);
      if (xpResult.error) {
        commit({ status: 'error', message: 'Could not read lifetime XP. Your quests are unchanged.' });
        return;
      }
      const verifiedXp = verifiedLifetimeXp(xpResult.data);
      if (verifiedXp === null) {
        commit({ status: 'error', message: 'Could not verify lifetime XP. Your quests and equipment are unchanged.' });
        return;
      }
      const profile = profileResult.error ? null : (profileResult.data as Record<string, unknown> | null);
      commit({
        status: 'ready',
        name: adventurerName(user.email, profile?.display_name),
        xp: verifiedXp,
        profile,
        preview: false,
        gear: gearResult.error ? null : parseAuthenticatedGearSnapshot(gearResult.data),
      });
    } catch {
      // A transient network failure is not evidence that the user signed out.
      commit({ status: 'error', message: 'Could not load your character. Your quests and equipment are unchanged.' });
    }
  }, []);

  async function setArmorEquipped(equip: boolean) {
    if (state.status !== 'ready' || state.preview || !state.gear || equipmentBusy || equipmentMutationInFlight.current) return;
    equipmentMutationInFlight.current = true;
    // An older focus refresh must not repaint stale gear during an equip RPC.
    loadGate.current.invalidate();
    setEquipmentBusy(true);
    setEquipmentError('');
    try {
      const { error } = await supabase().rpc('equip_earned_armor', {
        p_item_id: 'ashen-hood', p_equip: equip,
      });
      if (error) {
        setEquipmentError('Could not update your armor. Your equipment is unchanged.');
        return;
      }
      // Only the authoritative server read can change the visible equipment.
      // If that read fails, do not leave the previous gear snapshot looking
      // like a confirmed successful equip operation.
      setState({ status: 'loading' });
      await load();
    } catch {
      setEquipmentError('Could not update your armor. Try again.');
    } finally {
      equipmentMutationInFlight.current = false;
      setEquipmentBusy(false);
    }
  }

  useEffect(() => {
    void load();
    // Refresh verified XP and equipment when returning from Quest Board or another tab.
    const refreshOnFocus = () => { if (document.visibilityState === 'visible' && !equipmentMutationInFlight.current) void load(); };
    document.addEventListener('visibilitychange', refreshOnFocus);
    window.addEventListener('focus', refreshOnFocus);
    return () => {
      document.removeEventListener('visibilitychange', refreshOnFocus);
      window.removeEventListener('focus', refreshOnFocus);
      loadGate.current.invalidate();
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
        <p className="character-lifetime-xp" aria-label={`Lifetime XP: ${state.xp}`}>Lifetime XP: {state.xp}</p>
        <div className="xp-track" role="progressbar" aria-valuemin={0} aria-valuemax={progress.xpForNext} aria-valuenow={progress.xpIntoLevel} aria-label="Progress to next level"><span className="xp-fill" style={{ width: `${fraction * 100}%` }} /></div>
      </section>
      <p className="muted">{state.preview ? 'Equipment below is a visual demo using starter items.' : state.gear ? 'Armor ownership and equipped state are read from your account.' : 'Equipment is hidden until account ownership and equipped state can be verified. Your XP and attributes remain account-derived.'}</p>
      <CharacterScreen displayName={state.name} hideSampleStats equipmentMode={state.preview ? 'preview' : state.gear ? 'verified' : 'unverified'} verifiedGear={state.gear} onEquipArmor={(equip) => { void setArmorEquipped(equip); }} armorBusy={equipmentBusy} />
      {equipmentError && <p className="message" role="status">{equipmentError}</p>}
      <section className="panel" aria-label="Earn your next reward">
        <h2>Continue your adventure</h2>
        <p className="muted">Complete real-world quests for verified XP. Ashen Hood is earned only through your account's XP ledger and appears after a server-confirmed equip.</p>
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
