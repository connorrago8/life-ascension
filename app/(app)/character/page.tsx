'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import '../../preview/preview.css';
import { CharacterScreen } from '../../../components/preview/CharacterScreen';
import { attributeEntries, adventurerName } from '../../../lib/attributes';
import { parseCryptProfile } from '../../../lib/cryptVault';
import { levelFor, levelProgress } from '../../../lib/level';
import { verifiedLifetimeXp } from '../../../lib/characterXpProof';
import { createLatestCharacterLoadGate } from '../../../lib/preview/latestCharacterLoadGate';
import { supabase } from '../../../lib/supabase';
import { earnedArmorMilestone, parseAuthenticatedGearSnapshot, type AuthenticatedGearSnapshot } from '../../../lib/preview/characterGearView';
import { SERVER_EQUIPPABLE_ITEMS, canRequestEquip, isSlotUnlocked, levelForVerifiedXp, slotLockText, type GearSlotKey } from '../../../lib/gearSlots';
import { WELLNESS_EMPTY, wellnessSnapshot } from '../../../lib/wellness';

type LoadState =
  | { status: 'loading' }
  | { status: 'signed-out'; loginHref: string }
  | { status: 'error'; message: string }
  | { status: 'ready'; name: string; xp: number; profile: Record<string, unknown> | null; stats: Record<string, unknown> | null; preview: boolean; gear: AuthenticatedGearSnapshot | null };

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
      commit({ status: 'ready', name: 'Adventurer', xp: 2, profile: null, stats: null, preview: true, gear: null });
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
      const [xpResult, profileResult, gearResult, statsResult] = await Promise.all([
        client.rpc('get_lifetime_xp'),
        client.from('profiles').select('*').eq('id', user.id).maybeSingle(),
        client.rpc('get_earned_gear'),
        // Read-only: your STR/AGI/INT/END/LCK allocation (set in the Crypt camp, capped by level server-side).
        client.rpc('get_crypt_profile'),
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
        stats: statsResult.error ? null : parseCryptProfile(statsResult.data).attributes,
        preview: false,
        gear: gearResult.error ? null : parseAuthenticatedGearSnapshot(gearResult.data),
      });
    } catch {
      // A transient network failure is not evidence that the user signed out.
      commit({ status: 'error', message: 'Could not load your character. Your quests and equipment are unchanged.' });
    }
  }, []);

  async function setItemEquipped(slot: GearSlotKey, itemId: string, equip: boolean) {
    if (state.status !== 'ready' || state.preview || !state.gear || equipmentBusy || equipmentMutationInFlight.current) return;
    // Client pre-check only (owned + fits slot + level unlocked). The server RPC
    // independently enforces ownership and the level gate; it never grants items.
    const verifiedLevel = levelForVerifiedXp(state.xp);
    if (equip && !canRequestEquip(verifiedLevel, state.gear.ownedItemIds, slot, itemId)) {
      setEquipmentError(isSlotUnlocked(verifiedLevel, slot) ? 'That item is not available for this slot.' : `${slotLockText(slot)}.`);
      return;
    }
    if (!equip && SERVER_EQUIPPABLE_ITEMS[itemId] !== slot) return;
    equipmentMutationInFlight.current = true;
    // An older focus refresh must not repaint stale gear during an equip RPC.
    loadGate.current.invalidate();
    setEquipmentBusy(true);
    setEquipmentError('');
    try {
      const { error } = await supabase().rpc('equip_earned_armor', {
        p_item_id: itemId, p_equip: equip,
      });
      if (error) {
        setEquipmentError(error.message === 'Slot locked'
          ? `${slotLockText(slot)}. Your equipment is unchanged.`
          : 'Could not update your equipment. Your equipment is unchanged.');
        return;
      }
      // Only the authoritative server read can change the visible equipment.
      // If that read fails, do not leave the previous gear snapshot looking
      // like a confirmed successful equip operation.
      setState({ status: 'loading' });
      await load();
    } catch {
      setEquipmentError('Could not update your equipment. Try again.');
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
  // Allocated stats when the account has them; otherwise the placeholder dash.
  const attributes = attributeEntries(state.stats);
  const wellness = wellnessSnapshot(state.profile);
  const armorMilestone = state.preview ? null : earnedArmorMilestone(state.xp, state.gear);

  return (
    <main className="screen character-screen">
      <h1 className="sr-only">{state.name}</h1>
      {state.preview && <p className="preview-banner" role="status">Layout preview with 2 lifetime XP. Sign in to load your character.</p>}
      <section className="character-summary" aria-label="Level and stats">
        <div className="character-stat-row" role="list" aria-label="Stats">
          {attributes.map((attribute) => (
            <div key={attribute.key} className="character-stat" role="listitem" aria-label={attribute.pending ? `${attribute.label}, not set` : `${attribute.label} ${attribute.value}`}>
              <span className="character-stat-label" aria-hidden="true">{attribute.short}</span>
              <span className="character-stat-value" aria-hidden="true">{attribute.value}</span>
            </div>
          ))}
        </div>
        <div className="character-level-line">
          <span className="character-level">Lv {progress.level}</span>
          <div className="xp-track character-xp-track" role="progressbar" aria-valuemin={0} aria-valuemax={progress.xpForNext} aria-valuenow={progress.xpIntoLevel} aria-label={`Level ${progress.level}: ${progress.xpIntoLevel} of ${progress.xpForNext} XP to next level`}><span className="xp-fill" style={{ width: `${fraction * 100}%` }} /></div>
          <span className="character-level-xp" aria-hidden="true">{progress.xpIntoLevel}/{progress.xpForNext}</span>
        </div>
      </section>
      {state.preview && <p className="muted">Equipment below is a visual demo using starter items.</p>}
      {!state.preview && !state.gear && <p className="muted">Equipment unavailable right now. Refresh to retry.</p>}
      <CharacterScreen displayName={state.name} hideSampleStats equipmentMode={state.preview ? 'preview' : state.gear ? 'verified' : 'unverified'} verifiedGear={state.gear} playerLevel={state.preview ? null : levelForVerifiedXp(state.xp)} onEquipItem={(slot, itemId, equip) => { void setItemEquipped(slot, itemId, equip); }} armorBusy={equipmentBusy} />
      {equipmentError && <p className="message" role="status">{equipmentError}</p>}
      {armorMilestone && (
        <p className="muted character-milestone" aria-label="Ashen Hood progress">
          {armorMilestone.status === 'earning' && `Ashen Hood: ${armorMilestone.remainingXp} XP to go`}
          {armorMilestone.status === 'owned' && (isSlotUnlocked(progress.level, 'headwear') ? 'Ashen Hood earned. Tap Headwear to equip.' : `Ashen Hood earned. Headwear ${slotLockText('headwear').toLowerCase()}.`)}
          {armorMilestone.status === 'eligible-unconfirmed' && 'Ashen Hood: reached 10 XP, confirming. Refresh to check.'}
          {armorMilestone.status === 'unverified' && 'Ashen Hood status unavailable. Refresh to retry.'}
        </p>
      )}

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
