'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { QUEST_CHIPS, chipLabel, parseQuestChip, parseQuestView } from '../../lib/questWorkspace';
import { coupleMarkMessage, parseCoupleQuest, type CoupleQuestView } from '../../lib/coupleQuestView';
import { callerCoupleAward, shouldVibrate } from '../../lib/questPolish';
import { useCompanionRole } from '../useCompanionRole';
import { supabase } from '../../lib/supabase';
import PersonalQuestBoard from './PersonalQuestBoard';

export function QuestWorkspace() {
  const params = useSearchParams();
  const chip = parseQuestChip(params.get('chip') ?? params.get('area'));
  const focus = parseQuestView(params.get('view'));
  const role = useCompanionRole();
  const companion = role.mode === 'companion';
  const [couple, setCouple] = useState<CoupleQuestView[]>([]);
  const [bondRole, setBondRole] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [floatXp, setFloatXp] = useState<number | null>(null);
  const [unseen, setUnseen] = useState(0);

  const load = useCallback(async () => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('preview') === '1') {
      setCouple([{ id: 'shared-1', title: 'A walk without phones', description: 'A little time together.', cadence: 'weekly', dueAt: null, myDone: false, partnerDone: false, awarded: false }]);
      return;
    }
    const { data, error } = await supabase().rpc('couple_board');
    if (error || !data || typeof data !== 'object') { setCouple([]); return; }
    const payload = data as { quests?: unknown; role?: unknown };
    setBondRole(typeof payload.role === 'string' ? payload.role : null);
    const rows = payload.quests;
    setCouple(Array.isArray(rows) ? rows.map(parseCoupleQuest).filter((row): row is CoupleQuestView => !!row) : []);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function mark(id: string) {
    if (busy) return;
    const previous = couple.find((quest) => quest.id === id);
    setCouple((rows) => rows.map((quest) => (quest.id === id ? { ...quest, myDone: true } : quest)));
    setBusy(true);
    const { data, error } = await supabase().rpc('couple_quest_mark', { p_quest: id });
    setBusy(false);
    if (error) {
      if (previous) setCouple((rows) => rows.map((quest) => (quest.id === id ? previous : quest)));
      setNote('Could not confirm your part. Nothing was changed on this screen.');
      return;
    }
    const mine = callerCoupleAward(bondRole, data);
    if (mine) {
      setFloatXp(mine);
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (shouldVibrate(reduced, mine) && typeof navigator.vibrate === 'function') navigator.vibrate(10);
    }
    setNote(coupleMarkMessage(data));
    await load();
  }

  return (
    <main className="wrap quest-workspace">
      <header className="workspace-heading">
        <div>
          <p className="eyebrow">QUESTS</p>
          <h1>Your board</h1>
        </div>
      </header>
      <div className="quest-chips" role="tablist" aria-label="Quest filters">
        {QUEST_CHIPS.map((item) => {
          const selected = chip === item.id;
          const href = item.id === 'all' ? '/quests' : `/quests?chip=${item.id}`;
          return (
            <span key={item.id} className="chip-wrap">
              <Link role="tab" aria-selected={selected} aria-label={chipLabel(item.id, companion)} className={selected ? 'quest-chip is-on' : 'quest-chip'} href={href}>
                {chipLabel(item.id, companion)}
              </Link>
              {item.id === 'partner' && unseen > 0 && <span className="chip-badge" aria-hidden="true">{unseen}</span>}
            </span>
          );
        })}
      </div>
      <PersonalQuestBoard chip={chip} focus={focus} couple={couple} onMarkCouple={(id) => { void mark(id); }} coupleBusy={busy} onUnseen={setUnseen} />
      {floatXp != null && <p className="xp-float xp-float-board" role="status">+{floatXp} XP</p>}
      {note && <p className="message" role="status">{note}</p>}
    </main>
  );
}
