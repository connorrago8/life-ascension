'use client';

import { useState } from 'react';
import { ADVENTURER_COSMETICS, type AdventurerCosmetic } from '../lib/adventurerCosmetics';
import { supabase } from '../lib/supabase';
import { AdventurerCosmeticSprite } from './AdventurerCosmeticSprite';

const EMPTY_WORN: readonly string[] = [];

type Props = {
  level: number;
  wornIds?: readonly string[];
  onWornChange?: (ids: readonly string[]) => void;
  /** Layout preview only. Wear is not sent to the server. */
  readOnly?: boolean;
  label?: string;
};

export function AdventurerCosmeticTrack({ level, wornIds = EMPTY_WORN, onWornChange, readOnly = false, label }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const worn = new Set(wornIds);

  async function toggle(item: AdventurerCosmetic) {
    if (readOnly || item.unlockLevel > level || busy) return;
    const next = !worn.has(item.id);
    setBusy(true);
    setError('');
    const { error: rpcError } = await supabase().rpc('adventurer_set_worn', { p_id: item.id, p_wear: next });
    setBusy(false);
    if (rpcError) {
      setError(rpcError.message || 'Could not update that cosmetic.');
      return;
    }
    const copy = new Set(wornIds);
    if (next) {
      for (const other of ADVENTURER_COSMETICS) {
        if (other.slot === item.slot) copy.delete(other.id);
      }
      copy.add(item.id);
    } else {
      copy.delete(item.id);
    }
    onWornChange?.([...copy]);
  }

  return (
    <section className="adventurer-track" aria-label="Adventurer cosmetics">
      <div className="adventurer-stage">
        <AdventurerCosmeticSprite worn={wornIds} label={label} />
      </div>
      <h2 className="cq-section">Cosmetics</h2>
      <p className="muted">Unlocks every 2 levels from quest XP. Wear saves only through the server.</p>
      {readOnly && <p className="muted">Preview look. Nothing here is saved.</p>}
      <ul className="cq-track">
        {ADVENTURER_COSMETICS.map((item) => {
          const owned = item.unlockLevel <= level;
          const isWorn = worn.has(item.id);
          return (
            <li key={item.id} className={owned ? 'cq-tier is-owned' : 'cq-tier'}>
              <span className="cq-tier-level">L{item.unlockLevel}</span>
              <div>
                <strong>{item.label}</strong>
                <span className="muted"> · {item.description}</span>
              </div>
              {owned ? (
                <button
                  type="button"
                  className="btn ghost"
                  disabled={busy || readOnly}
                  onClick={() => void toggle(item)}
                >
                  {isWorn ? 'Take off' : 'Wear'}
                </button>
              ) : (
                <span className="cq-lock">Locked</span>
              )}
            </li>
          );
        })}
      </ul>
      {error && <p className="message" role="status">{error}</p>}
    </section>
  );
}
