'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { loadPillSnapshot, type PillSnapshot } from '../lib/status/loadPill';
import { pillAriaLabel } from '../lib/status/pill';

type Mode = 'companion' | 'adventurer';
type Placement = 'open' | 'collapsed' | 'hidden';
const STORAGE_KEY = 'la.engage.pill';

function readPlacement(): Placement {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (value === 'collapsed' || value === 'hidden' || value === 'open') return value;
  } catch { /* private mode */ }
  return 'open';
}

function writePlacement(value: Placement) {
  try { window.localStorage.setItem(STORAGE_KEY, value); } catch { /* private mode */ }
}

async function syncBadge(count: number) {
  const nav = navigator as Navigator & {
    setAppBadge?: (value: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };
  try {
    if (count > 0 && nav.setAppBadge) await nav.setAppBadge(count);
    else if (nav.clearAppBadge) await nav.clearAppBadge();
  } catch { /* The badge API is optional and may be denied. */ }
}

export function StatusPill({ mode }: { mode: Mode }) {
  const [snapshot, setSnapshot] = useState<PillSnapshot | null>(null);
  const [placement, setPlacement] = useState<Placement>('open');

  useEffect(() => {
    setPlacement(readPlacement());
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const client = supabase();
        const { data, error } = await client.auth.getUser();
        if (!active || error || !data.user) return;
        const next = await loadPillSnapshot(client, data.user.id, mode);
        if (!active) return;
        setSnapshot(next);
        if (next) void syncBadge(next.badge);
      } catch { /* Supabase is not configured in this browser. */ }
    };
    void load();
    const refresh = () => { if (document.visibilityState === 'visible') void load(); };
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      active = false;
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [mode]);

  if (!snapshot) return null;

  function place(next: Placement) {
    setPlacement(next);
    writePlacement(next);
  }

  if (placement === 'hidden') {
    return (
      <div className="engage-pill is-hidden">
        <button type="button" className="engage-restore" onClick={() => place('open')} aria-label="Show today's status">▲</button>
      </div>
    );
  }

  return (
    <div className={'engage-pill' + (placement === 'collapsed' ? ' is-collapsed' : '')}>
      {placement === 'open' && (
        <Link href={snapshot.href} className="engage-pill-link" aria-label={pillAriaLabel(snapshot, snapshot.href)}>
          <span className="engage-pill-quests">{snapshot.questLabel}</span>
          <span className="engage-pill-streak">🔥 {snapshot.streak}</span>
          <span className="engage-pill-xp">{snapshot.xpLabel}</span>
        </Link>
      )}
      <div className="engage-pill-actions">
        <button type="button" aria-label={placement === 'collapsed' ? 'Expand today status' : 'Collapse today status'} onClick={() => place(placement === 'collapsed' ? 'open' : 'collapsed')}>
          {placement === 'collapsed' ? snapshot.questLabel : '–'}
        </button>
        <button type="button" aria-label="Hide today status" onClick={() => place('hidden')}>×</button>
      </div>
    </div>
  );
}
