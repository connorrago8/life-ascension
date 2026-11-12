'use client';

import { useEffect, useState } from 'react';
import { nextLevelTier, PASS_TIERS } from '../../lib/companionPass';
import { levelProgress } from '../../lib/level';
import { supabase } from '../../lib/supabase';
import { CompanionHero } from './CompanionHero';

export type WardrobeItem = {
  id: string;
  label: string;
  slot: string;
  unlockLevel: number;
  owned: boolean;
  worn: boolean;
  fresh: boolean;
  grantKind?: string;
  activityKey?: string | null;
  activityNeed?: number | null;
  description?: string | null;
};

export type Wardrobe = {
  level: number;
  xp: number;
  xpForNext: number;
  items: WardrobeItem[];
};

export function useCompanionWardrobe() {
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

  return { wardrobe, banner, note, busy, wear };
}

export function CompanionPassView({
  wardrobe,
  banner,
  note,
  busy,
  onWear,
}: {
  wardrobe: Wardrobe | null;
  banner: string[];
  note?: string;
  busy?: boolean;
  onWear?: (id: string, on: boolean) => void;
}) {
  const items = wardrobe?.items ?? [];
  const worn = items.filter((item) => item.worn).map((item) => item.id);
  const fraction = wardrobe ? levelProgress(wardrobe.xp) : 0;
  const ordered = [...items].sort((a, b) => a.unlockLevel - b.unlockLevel || a.label.localeCompare(b.label));

  return (
    <section className="companion-card cq-pass" aria-label="Battle pass">
      <div className={banner.length > 0 ? 'cq-stage is-celebrating' : 'cq-stage'}>
        <CompanionHero worn={worn} />
      </div>
      {wardrobe && (
        <div className="cq-level">
          <p>Level {wardrobe.level}</p>
          <div className="cq-xpbar" aria-label={`${wardrobe.xp} XP toward the next level`}>
            <span style={{ width: `${Math.round(fraction * 100)}%` }} />
          </div>
          <p className="muted">{wardrobe.xp} XP · {wardrobe.xpForNext} to the next level</p>
        </div>
      )}
      {banner.length > 0 && (
        <p className="companion-fanfare" role="status">
          New gear: {banner.join(', ')}
        </p>
      )}
      <h2 className="cq-section">Battle pass</h2>
      <ol className="cq-track">
        {ordered.filter((item) => item.grantKind !== 'activity').map((item) => (
          <Tier key={item.id} item={item} busy={busy} onWear={onWear} />
        ))}
      </ol>
      <h2 className="cq-section">From her days</h2>
      <ol className="cq-track">
        {ordered.filter((item) => item.grantKind === 'activity').map((item) => (
          <Tier key={item.id} item={item} busy={busy} onWear={onWear} />
        ))}
      </ol>
      {items.length === 0 && <p className="muted">{PASS_TIERS.length} cosmetic tiers. Clothes never change quests or combat.</p>}
      {note && <p className="message" role="status">{note}</p>}
    </section>
  );
}

export function CompanionWardrobe() {
  const state = useCompanionWardrobe();
  return (
    <CompanionPassView
      wardrobe={state.wardrobe}
      banner={state.banner}
      note={state.note}
      busy={state.busy}
      onWear={(id, on) => void state.wear(id, on)}
    />
  );
}

function Tier({
  item,
  busy,
  onWear,
}: {
  item: WardrobeItem;
  busy?: boolean;
  onWear?: (id: string, on: boolean) => void;
}) {
  return (
    <li className={item.owned ? 'cq-tier is-owned' : 'cq-tier'}>
      <span className="cq-tier-level">{item.grantKind === 'activity' ? '★' : item.unlockLevel}</span>
      <span>
        <strong>{item.label}</strong>
        <small>
          {item.description
            ? item.description
            : item.grantKind === 'activity'
            ? `Log ${item.activityKey} ${item.activityNeed} times`
            : `Level ${item.unlockLevel}`}
        </small>
      </span>
      {item.owned ? (
        <button className="btn ghost" type="button" aria-pressed={item.worn} disabled={busy} onClick={() => onWear?.(item.id, !item.worn)}>
          {item.worn ? 'Take off' : 'Wear'}
        </button>
      ) : (
        <span className="cq-lock">Locked</span>
      )}
    </li>
  );
}

export function nextTierLabel(items: readonly WardrobeItem[]): string | null {
  const next = nextLevelTier(items);
  if (!next) return null;
  return items.find((item) => item.id === next.id)?.label ?? null;
}
