'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { DelveRun } from '../crypt/DelveRun';
import { capNote, floorClearMessage, parseCryptProfile } from '../../lib/cryptVault';
import { coerceXp, levelFor } from '../../lib/level';
import { supabase } from '../../lib/supabase';
import { ZERO_ATTRIBUTES, type Attributes } from '../../lib/crypt/delve/stats';
import { ownedEarnedGear } from '../../lib/crypt/delve/loot';
import type { RunRecap, SaveMode } from '../../lib/crypt/delve/recap';
import { recordRunEnd } from '../../lib/cryptReturn';
import { browserStorage, clearActiveRun, isLiveRun, loadActiveRun, runOwner, saveActiveRun } from '../../lib/cryptActiveRun';
import type { DelveState } from '../../lib/crypt/delve/run';
import { parseAuthenticatedGearSnapshot } from '../../lib/preview/characterGearView';

/**
 * Account layer for the Crypt delve. Reads the hero's level (real quests only)
 * and the Crypt vault, and reports drops and floor clears to server functions
 * that enforce every limit. An unfinished run is kept in this browser (per owner)
 * so a reload, the Play tab or leaving and coming back resumes it. Signing out
 * clears it and remounts the run, which ends it.
 */
type Mode = 'loading' | 'preview' | 'guest' | 'offline' | 'online';

const EXIT = '/play';

export function DelveScreen() {
  const [mode, setMode] = useState<Mode>('loading');
  const [level, setLevel] = useState(1);
  const [attributes, setAttributes] = useState<Attributes>(ZERO_ATTRIBUTES);
  const [vault, setVault] = useState<string[]>([]);
  const [xpNote, setXpNote] = useState('');
  const [session, setSession] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [inRun, setInRun] = useState(false);

  useEffect(() => {
    const preview = process.env.NODE_ENV === 'development'
      && new URLSearchParams(window.location.search).get('preview') === '1';
    if (preview) {
      setLevel(3);
      setAttributes({ strength: 4, agility: 3, intelligence: 3, endurance: 3, luck: 2 });
      setMode('preview');
      return;
    }
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      setMode('guest');
      return;
    }
    let cancelled = false;
    const client = supabase();
    const { data: { subscription } } = client.auth.onAuthStateChange((event) => {
      // Logging out ends any unfinished run.
      if (event === 'SIGNED_OUT' && !cancelled) {
        const storage = browserStorage();
        if (storage) clearActiveRun(storage);
        setUserId(null);
        setSession((n) => n + 1);
        setMode('guest');
        setLevel(1);
        setVault([]);
        setAttributes(ZERO_ATTRIBUTES);
      }
    });
    (async () => {
      try {
        const { data, error } = await client.auth.getUser();
        if (cancelled) return;
        if (error || !data.user) {
          setMode('guest');
          return;
        }
        setUserId(data.user.id);
        const xp = await client.rpc('get_lifetime_xp');
        if (cancelled) return;
        if (!xp.error) setLevel(levelFor(coerceXp(xp.data)).level);
        const profile = await client.rpc('get_crypt_profile');
        if (cancelled) return;
        if (profile.error) {
          setMode('offline');
          return;
        }
        const parsed = parseCryptProfile(profile.data);
        // Real-quest earned armor you own (Ashen Hood) also works in the Crypt. Read-only.
        let earned: string[] = [];
        try {
          const gear = await client.rpc('get_earned_gear');
          if (!gear.error) earned = ownedEarnedGear(parseAuthenticatedGearSnapshot(gear.data)?.ownedItemIds);
        } catch {
          earned = [];
        }
        if (cancelled) return;
        setAttributes(parsed.attributes);
        setVault([...earned, ...parsed.vaultItemIds.filter((id) => !earned.includes(id))]);
        setXpNote(capNote(parsed.tenthsToday, parsed.capToday));
        setMode('online');
      } catch {
        if (!cancelled) setMode('offline');
      }
    })();
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const online = mode === 'online';

  const onSaveAttributes = useCallback(async (next: Attributes) => {
    setAttributes(next);
    if (!online) return false;
    try {
      const { error } = await supabase().rpc('set_crypt_attributes', {
        p_strength: next.strength, p_agility: next.agility, p_intelligence: next.intelligence,
        p_endurance: next.endurance, p_luck: next.luck,
      });
      return !error;
    } catch {
      return false;
    }
  }, [online]);

  const onLoot = useCallback(async (runId: string, dropIndex: number, itemId: string): Promise<boolean> => {
    if (!online) return false;
    try {
      const { error } = await supabase().rpc('claim_crypt_loot', { p_run_id: runId, p_drop_index: dropIndex, p_item_id: itemId });
      return !error;
    } catch {
      /* The run keeps going; the item stays in this visit's vault. */
      return false;
    }
  }, [online]);

  const saveMode: SaveMode = mode === 'online' ? 'vault' : mode === 'preview' ? 'preview' : 'visit';
  // One-time Home banner ("Back from the Crypt"): result and item count only, keyed by run id. No worn gear.
  const onRunEnd = useCallback((recap: RunRecap, kept: number) => {
    recordRunEnd({ runId: recap.runId, result: recap.result, floor: recap.floor, kept, mode: saveMode, endedAt: Date.now() });
  }, [saveMode]);

  const onFloorCleared = useCallback(async (runId: string, floor: number) => {
    if (!online) return 'Floor cleared. Sign in with the Crypt vault online to save checkpoints and earn capped Crypt XP.';
    try {
      const { data, error } = await supabase().rpc('record_crypt_floor_clear', { p_run_id: runId, p_floor: floor });
      if (error) return 'Floor cleared, but the checkpoint could not be saved.';
      return floorClearMessage(data);
    } catch {
      return 'Floor cleared, but the checkpoint could not be saved.';
    }
  }, [online]);

  // Resume the owner's unfinished run once we know who is playing (read once per session).
  const owner = mode === 'loading' ? null : runOwner(mode, userId);
  const resume = useMemo(() => {
    const storage = browserStorage();
    return owner && storage ? loadActiveRun(storage, owner, Date.now()) : null;
  }, [owner, session]);
  const onStateChange = useCallback((state: DelveState | null) => {
    setInRun(isLiveRun(state));
    const storage = browserStorage();
    // Camp (no run) keeps a saved run untouched; a live run is saved; an over run is cleared.
    if (!owner || !storage || !state) return;
    saveActiveRun(storage, owner, state, Date.now());
  }, [owner]);
  const onEndRun = useCallback(() => {
    const storage = browserStorage();
    if (storage) clearActiveRun(storage);
    setInRun(false);
  }, []);

  // Dungeon mode: hide the app's bottom nav while a run is live (shown again at camp and on the recap).
  useEffect(() => {
    const root = document.documentElement;
    if (inRun) root.setAttribute('data-delve-run', 'live');
    else root.removeAttribute('data-delve-run');
    return () => root.removeAttribute('data-delve-run');
  }, [inRun]);

  if (mode === 'loading') {
    return <main className="wrap delve"><p className="muted" role="status">Opening the Crypt…</p></main>;
  }

  const keepNote = mode === 'online'
    ? `Gear is saved to your vault the moment it drops. ${xpNote}`
    : mode === 'offline'
      ? 'Crypt vault is offline: gear and your build are kept for this visit only. No Crypt XP.'
      : mode === 'preview'
        ? 'Dev preview: nothing is saved.'
        : 'Not signed in: playing at Level 1. Gear is kept for this visit only. No Crypt XP.';

  return (
    <DelveRun
      key={`${session}:${owner}`}
      resume={resume}
      onStateChange={onStateChange}
      onEndRun={onEndRun}
      level={level}
      savedAttributes={attributes}
      vaultItemIds={vault}
      keepNote={keepNote}
      exitHref={EXIT}
      onSaveAttributes={onSaveAttributes}
      onLoot={onLoot}
      onFloorCleared={onFloorCleared}
      saveMode={saveMode}
      onRunEnd={onRunEnd}
    />
  );
}
