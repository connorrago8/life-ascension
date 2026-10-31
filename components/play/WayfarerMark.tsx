'use client';

import { useEffect, useState } from 'react';
import { wayfarerLabel } from '../../lib/crypt/content';
import { coerceXp, levelFor } from '../../lib/level';
import { supabase } from '../../lib/supabase';

/**
 * Read-only level chip. Displays the signed-in Wayfarer's level.
 * It never inserts, updates, or grants XP.
 */
export function WayfarerMark() {
  const [level, setLevel] = useState<number | null>(null);

  useEffect(() => {
    const preview = process.env.NODE_ENV === 'development'
      && new URLSearchParams(window.location.search).get('preview') === '1';
    if (preview) {
      setLevel(1);
      return;
    }
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return;

    let cancelled = false;
    (async () => {
      try {
        const client = supabase();
        const { data, error } = await client.auth.getUser();
        if (cancelled || error || !data.user) return;
        const xp = await client.rpc('get_lifetime_xp');
        if (cancelled || xp.error) return;
        setLevel(levelFor(coerceXp(xp.data)).level);
      } catch {
        /* Display stays "Wayfarer" when the read fails. */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return <p className="wayfarer-mark">{wayfarerLabel(level)}</p>;
}
