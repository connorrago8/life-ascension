'use client';

import { useState } from 'react';
import { ADVENTURER_COSMETICS, type AdventurerCosmetic } from '../lib/adventurerCosmetics';

type Props = {
  level: number;
  wornIds?: readonly string[];
  onWear?: (id: string, wear: boolean) => void;
};

export function AdventurerCosmeticTrack({ level, wornIds = [], onWear }: Props) {
  const [localWorn, setLocalWorn] = useState<Set<string>>(new Set(wornIds));

  function toggle(item: AdventurerCosmetic) {
    if (item.unlockLevel > level) return;
    const next = !localWorn.has(item.id);
    setLocalWorn((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(item.id);
      else copy.delete(item.id);
      return copy;
    });
    onWear?.(item.id, next);
  }

  return (
    <section className="adventurer-track" aria-label="Adventurer cosmetics">
      <h2 className="cq-section">Cosmetics</h2>
      <p className="muted">Unlocks every 2 levels. Tap Wear to equip.</p>
      <ul className="cq-track">
        {ADVENTURER_COSMETICS.map((item) => {
          const owned = item.unlockLevel <= level;
          const worn = localWorn.has(item.id);
          return (
            <li key={item.id} className={owned ? 'cq-tier is-owned' : 'cq-tier'}>
              <span className="cq-tier-level">L{item.unlockLevel}</span>
              <div>
                <strong>{item.label}</strong>
                <span className="muted"> · {item.slot}</span>
              </div>
              {owned ? (
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => toggle(item)}
                >
                  {worn ? 'Take off' : 'Wear'}
                </button>
              ) : (
                <span className="cq-lock">Locked</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
