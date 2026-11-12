'use client';

import { useEffect, useState } from 'react';
import '../../app/couple.css';
import { shieldLabel } from '../../lib/streakShield';
import { supabase } from '../../lib/supabase';

type ShieldStatus = 'ready' | 'used';

/** Connor's monthly shield. The used state is a full sentence, not a silent flag. */
export function StreakShieldNote() {
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    if (params?.get('preview') === '1') {
      const status: ShieldStatus = params.get('shield') === 'used' ? 'used' : 'ready';
      setNotice(shieldLabel(status, { doneToday: false }));
      return;
    }
    let active = true;
    void (async () => {
      try {
        const { data, error } = await supabase().rpc('get_streak_shield');
        if (!active || error || !data || typeof data !== 'object') return;
        const row = data as { status?: unknown; notice?: unknown; doneToday?: unknown };
        if (typeof row.notice === 'string' && row.notice.startsWith('Streak Shield')) {
          setNotice(row.notice);
          return;
        }
        if (row.status === 'ready' || row.status === 'used') {
          setNotice(shieldLabel(row.status, { doneToday: row.doneToday === true, blocked: row.status === 'used' && row.doneToday === false && typeof row.notice === 'string' && row.notice.includes('No shields left') }));
        }
      } catch { /* Supabase is not configured in this browser. */ }
    })();
    return () => { active = false; };
  }, []);

  if (!notice) return null;
  return <p className="streak-shield" role="status">{notice}</p>;
}
