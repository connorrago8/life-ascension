'use client';

import { useEffect, useState } from 'react';
import { CharacterScreen } from '../../../components/preview/CharacterScreen';
import {
  parseAuthenticatedGearSnapshot,
  type AuthenticatedGearSnapshot,
} from '../../../lib/preview/characterGearView';

const STORAGE_KEY = 'life-ascension.qa-character-gear-mock';

/**
 * Real CharacterScreen with a clearly synthetic, local-only "server" snapshot.
 * This tests visual transitions and reload behavior, NOT authenticated
 * ownership, real RPCs, database persistence or XP awards.
 */
export function CharacterGearQAHarness() {
  const [gear, setGear] = useState<AuthenticatedGearSnapshot | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      setGear(raw ? parseAuthenticatedGearSnapshot(JSON.parse(raw) as unknown) : null);
    } catch {
      setGear(null);
    }
    setHydrated(true);
  }, []);

  function confirmMockSnapshot(value: unknown) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    setGear(parseAuthenticatedGearSnapshot(value));
  }

  async function mockEquip(equip: boolean) {
    if (!gear?.ownedItemIds.includes('ashen-hood') || busy) return;
    setBusy(true);
    try {
      // The fixture models a confirmed read after a mock write. No real RPC.
      await Promise.resolve();
      confirmMockSnapshot({
        ownedItemIds: ['ashen-hood'],
        equippedItemIds: equip ? ['ashen-hood'] : [],
      });
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    localStorage.removeItem(STORAGE_KEY);
    setGear(null);
  }

  return <section aria-label="Local character gear QA" data-qa-hydrated={hydrated ? 'true' : 'false'}>
    <p role="status">Synthetic local snapshot only. No login, Supabase, XP or server writes.</p>
    <div className="actions">
      <button type="button" className="btn ghost" onClick={() => confirmMockSnapshot({
        ownedItemIds: ['ashen-hood'], equippedItemIds: [],
      })}>Mock server: grant Ashen Hood</button>
      <button type="button" className="btn ghost" onClick={() => confirmMockSnapshot({
        ownedItemIds: [], equippedItemIds: ['ashen-hood'],
      })}>Mock server: invalid unowned equip</button>
      <button type="button" className="btn ghost" onClick={reset}>Reset mock ownership</button>
    </div>
    {hydrated && <CharacterScreen
      displayName="Local QA Adventurer"
      hideSampleStats
      equipmentMode={gear ? 'verified' : 'unverified'}
      verifiedGear={gear}
      onEquipArmor={(equip) => { void mockEquip(equip); }}
      armorBusy={busy}
    />}
  </section>;
}
