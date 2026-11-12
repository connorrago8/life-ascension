'use client';

import { useEffect, useState } from 'react';
import '../../app/couple.css';
import type { RecapPartner } from '../../lib/coupleRecap';
import { supabase } from '../../lib/supabase';

type RecapPayload = {
  visible?: boolean;
  weekStart?: string;
  partners?: RecapPartner[];
};

type Fallback = { done?: number; streak?: number; xp?: number };

function PartnerLine({ partner }: { partner: RecapPartner }) {
  const name = partner.role === 'adventurer' ? 'Connor' : 'Izzy';
  return (
    <div className="couple-partner">
      <strong>{name}</strong>
      <span>{partner.done} done</span>
      <span>{partner.xp} XP</span>
      <span>{partner.levelsGained} levels</span>
      <span>Longest streak {partner.longestStreak}</span>
    </div>
  );
}

/** Fills the existing Sunday recap slot. Falls back to the bond summary if the RPC is absent. */
export function SundayRecapCard({ fallback }: { fallback?: Fallback | null }) {
  const [recap, setRecap] = useState<RecapPayload | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { data, error } = await supabase().rpc('couple_weekly_recap');
        if (!active || error || !data || typeof data !== 'object') return;
        setRecap(data as RecapPayload);
      } catch { /* Supabase is not configured in this browser. */ }
    })();
    return () => { active = false; };
  }, []);

  if (recap && recap.visible === false) return null;
  const partners = recap?.partners ?? [];
  return (
    <div>
      <h2>This week</h2>
      <p className="muted">Previous Sunday 5:00 AM through this Sunday 4:59 AM, Chicago.</p>
      {partners.length > 0 ? (
        <div className="couple-recap-grid">
          {partners.map((partner) => <PartnerLine key={partner.role} partner={partner} />)}
        </div>
      ) : (
        <p>{fallback?.done ?? 0} of her quests done. Streak {fallback?.streak ?? 0}. {fallback?.xp ?? 0} XP from those quests.</p>
      )}
    </div>
  );
}
