'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';

type Recent = { key: string; amount: number; label: string };

/** Recent confirmed XP and the open-quest count. Read-only. */
export function RecentQuestStrip() {
  const [recent, setRecent] = useState<Recent[] | null>(null);
  const [openCount, setOpenCount] = useState<number | null>(null);

  useEffect(() => {
    let cancel = false;
    void (async () => {
      const client = supabase();
      const { data: auth } = await client.auth.getUser();
      if (!auth.user || cancel) return;
      const [ledger, nights, open] = await Promise.all([
        client.from('xp_ledger').select('id,amount,awarded_at').eq('owner_id', auth.user.id).order('awarded_at', { ascending: false }).limit(5),
        client.from('health_lights_out').select('game_day,xp_awarded,created_at').eq('owner_id', auth.user.id).order('created_at', { ascending: false }).limit(5),
        client.from('quest_instances').select('id').eq('owner_id', auth.user.id).eq('status', 'available').limit(1000),
      ]);
      if (cancel) return;
      const rows: Recent[] = [];
      for (const row of (ledger.data ?? []) as { id?: string; amount?: number; awarded_at?: string }[]) {
        if (row.id && typeof row.amount === 'number') rows.push({ key: row.id, amount: row.amount, label: row.awarded_at?.slice(0, 10) ?? 'Quest' });
      }
      if (!nights.error) {
        for (const row of (nights.data ?? []) as { game_day?: string; xp_awarded?: number }[]) {
          if (row.game_day && typeof row.xp_awarded === 'number') rows.push({ key: `night:${row.game_day}`, amount: row.xp_awarded, label: `Lights out ${row.game_day}` });
        }
      }
      setRecent(rows.slice(0, 5));
      setOpenCount(open.error ? null : (open.data ?? []).length);
    })();
    return () => { cancel = true; };
  }, []);

  return (
    <section className="ascension-strip" aria-label="Recent XP and open quests">
      <h2>Recent XP</h2>
      {recent === null && <p className="muted">Loading recent XP…</p>}
      {recent && recent.length === 0 && <p className="muted">No XP recorded yet.</p>}
      {recent && recent.length > 0 && (
        <ul className="ascension-rows">
          {recent.map((row) => <li key={row.key} className="ascension-row"><span>{row.label}</span><strong>+{row.amount} XP</strong></li>)}
        </ul>
      )}
      {openCount !== null && <p><Link href="/quests">{openCount} open quest{openCount === 1 ? '' : 's'}</Link></p>}
    </section>
  );
}
