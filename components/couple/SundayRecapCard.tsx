'use client';

import { useEffect, useState } from 'react';
import '../../app/couple.css';
import { recapLines, type RecapFacts } from '../../lib/recapTemplate';
import { supabase } from '../../lib/supabase';

type Partner = {
  role?: string;
  xp?: number;
  level?: number;
  levelsGained?: number;
};

type RecapPayload = {
  visible?: boolean;
  weekStart?: string | null;
  weekEnd?: string | null;
  coupleQuestsCompleted?: number;
  bestMomentTitle?: string | null;
  coupleQuestTitle?: string | null;
  unlockNames?: string[];
  nextQuestTitle?: string | null;
  partners?: Partner[];
};

function factsFrom(recap: RecapPayload): RecapFacts | null {
  if (!recap.weekStart || !recap.weekEnd) return null;
  const connor = recap.partners?.find((partner) => partner.role === 'adventurer');
  const izzy = recap.partners?.find((partner) => partner.role === 'companion');
  return {
    weekStart: recap.weekStart,
    weekEnd: recap.weekEnd,
    connorXp: connor?.xp ?? 0,
    connorLevel: connor?.level ?? 1,
    izzyXp: izzy?.xp ?? 0,
    izzyLevel: izzy?.level ?? 1,
    coupleQuestsCompleted: recap.coupleQuestsCompleted ?? 0,
    bestMomentTitle: recap.bestMomentTitle ?? null,
    coupleQuestTitle: recap.coupleQuestTitle ?? null,
    unlockNames: recap.unlockNames ?? [],
    nextQuestTitle: recap.nextQuestTitle ?? null,
    seed: `${recap.weekStart}:${connor?.xp ?? 0}:${izzy?.xp ?? 0}`,
  };
}

/** Sunday recap. Lines come from the server payload. Missing moments stay the empty sentence. */
export function SundayRecapCard({ previewFacts }: { previewFacts?: RecapFacts | null }) {
  const [recap, setRecap] = useState<RecapPayload | null>(null);

  useEffect(() => {
    if (previewFacts) return undefined;
    let active = true;
    void (async () => {
      try {
        const { data, error } = await supabase().rpc('couple_weekly_recap');
        if (!active || error || !data || typeof data !== 'object') return;
        setRecap(data as RecapPayload);
      } catch { /* Supabase is not configured in this browser. */ }
    })();
    return () => { active = false; };
  }, [previewFacts]);

  const facts = previewFacts ?? (recap ? factsFrom(recap) : null);
  if (recap && recap.visible === false && !previewFacts) return null;
  if (!facts) return null;
  const lines = recapLines(facts);
  return (
    <div>
      <h2>{lines[0]}</h2>
      {lines.slice(1).map((line) => <p key={line}>{line}</p>)}
      <p className="muted">See our week</p>
    </div>
  );
}
