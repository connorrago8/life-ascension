'use client';

import { useEffect, useState } from 'react';
import { ADVENTURER_COSMETICS, type AdventurerCosmetic } from '../lib/adventurerCosmetics';
import { supabase } from '../lib/supabase';
import { CosmeticLevelUp } from './CosmeticLevelUp';

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
  const [wardrobeOpen, setWardrobeOpen] = useState(false);
  const [error, setError] = useState('');
  const [levelUp, setLevelUp] = useState<number | null>(null);
  const worn = new Set(wornIds);

  useEffect(() => {
    if (readOnly || typeof window === 'undefined') return;
    const key = 'la.cosmetic-level.connor';
    const stored = window.localStorage.getItem(key);
    const previous = stored == null ? null : Number(stored);
    if (previous == null || !Number.isFinite(previous)) {
      window.localStorage.setItem(key, String(level));
      return;
    }
    if (level > previous) {
      window.localStorage.setItem(key, String(level));
      setLevelUp(level);
    }
  }, [level, readOnly]);

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

  const unlocked = levelUp == null ? null : ADVENTURER_COSMETICS.find((item) => item.unlockLevel === levelUp) ?? null;
  return (
    <section className="adventurer-track" aria-label="Adventurer cosmetics">
      {levelUp != null && (
        <CosmeticLevelUp
          who="connor"
          level={levelUp}
          item={unlocked ? { id: unlocked.id, label: unlocked.label } : null}
          characterHref="/character"
          onClose={() => setLevelUp(null)}
        />
      )}
      <button
        type="button"
        className="btn ghost"
        aria-expanded={wardrobeOpen}
        aria-controls="adventurer-wardrobe-rewards"
        onClick={() => setWardrobeOpen((open) => !open)}
      >
        {wardrobeOpen ? 'Close Wardrobe' : 'Wardrobe'}
      </button>
      {wardrobeOpen && (
        <div id="adventurer-wardrobe-rewards">
          <h2 className="cq-section">Cosmetics</h2>
          <p className="muted">Unlock a new piece every 2 levels. Cosmetics never change stats.</p>
          {readOnly && <p className="muted">Preview only. Nothing here is saved.</p>}
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
        </div>
      )}
      {error && <p className="message" role="status">{error}</p>}
    </section>
  );
}
