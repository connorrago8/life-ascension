'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { CompanionLook } from './CompanionLook';

type Item = {
  id: string;
  label: string;
  slot: string;
  unlockLevel: number;
  owned: boolean;
  worn: boolean;
  fresh: boolean;
};

type Wardrobe = {
  level: number;
  xp: number;
  xpForNext: number;
  items: Item[];
};

export function CompanionWardrobe() {
  const [wardrobe, setWardrobe] = useState<Wardrobe | null>(null);
  const [banner, setBanner] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data, error } = await supabase().rpc('companion_wardrobe');
    if (error) {
      setNote(error.message);
      return;
    }
    const next = data as Wardrobe;
    setWardrobe(next);
    const fresh = (next.items ?? []).filter((item) => item.fresh).map((item) => item.label);
    if (fresh.length > 0) {
      setBanner(fresh);
      await supabase().rpc('companion_mark_cosmetics_seen');
    }
  }

  useEffect(() => { void load(); }, []);

  async function wear(id: string, on: boolean) {
    setBusy(true);
    setNote('');
    const { data, error } = await supabase().rpc('companion_wear_cosmetic', { p_id: id, p_wear: on });
    setBusy(false);
    if (error) {
      setNote(error.message);
      return;
    }
    setWardrobe(data as Wardrobe);
  }

  const worn = (wardrobe?.items ?? []).filter((item) => item.worn).map((item) => item.id);
  const nextLocked = (wardrobe?.items ?? []).find((item) => !item.owned);

  return (
    <section className="panel companion-card" aria-label="Wardrobe">
      <CompanionLook worn={worn} size={96} />
      <h2>Wardrobe</h2>
      <p className="muted">Clothes only. Logged activities raise the level. Nothing here changes quests or combat.</p>
      {wardrobe && (
        <p>Level {wardrobe.level} · {wardrobe.xp} XP · {wardrobe.xpForNext} XP to the next level</p>
      )}
      {banner.length > 0 && (
        <p className="companion-fanfare" role="status">Unlocked: {banner.join(', ')}</p>
      )}
      {nextLocked && <p className="muted">Next: {nextLocked.label} at level {nextLocked.unlockLevel}.</p>}
      <ul className="companion-wardrobe">
        {(wardrobe?.items ?? []).map((item) => (
          <li key={item.id}>
            <span>{item.label}</span>
            {item.owned ? (
              <button
                className="btn ghost"
                type="button"
                aria-pressed={item.worn}
                disabled={busy}
                onClick={() => void wear(item.id, !item.worn)}
              >
                {item.worn ? 'Take off' : 'Wear'}
              </button>
            ) : (
              <span className="muted">Level {item.unlockLevel}</span>
            )}
          </li>
        ))}
      </ul>
      {note && <p className="message" role="status">{note}</p>}
    </section>
  );
}
