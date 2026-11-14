'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { formatResetCountdown, minutesUntilGameDayReset } from '../lib/gameDayReset';
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
  const [expanded, setExpanded] = useState(false);
  const [resetLabel, setResetLabel] = useState('');

  useEffect(() => {
    setPlacement(readPlacement());
  }, []);

  useEffect(() => {
    const tick = () => setResetLabel(formatResetCountdown(minutesUntilGameDayReset(new Date())));
    tick();
    const timer = window.setInterval(tick, 30_000);
    return () => window.clearInterval(timer);
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

  const ring = snapshot.total > 0 ? snapshot.completed / snapshot.total : 0;
  return (
    <div className={'engage-pill' + (expanded ? ' is-open' : '')}>
      <button type="button" className="engage-face" aria-expanded={expanded} aria-label={pillAriaLabel(snapshot, snapshot.href)} onClick={() => setExpanded((value) => !value)}>
        <ProgressRing fraction={ring} />
        <span className="engage-flame" aria-hidden="true">🔥 {snapshot.streak}</span>
      </button>
      {expanded && (
        <div className="engage-extra">
          <Link href={snapshot.href}>{snapshot.questLabel}</Link>
          <span className="engage-dim">{resetLabel}</span>
          <span className="engage-dim">{snapshot.xpLabel} XP</span>
        </div>
      )}
      <button type="button" className="engage-hide" aria-label="Hide today status" onClick={() => place('hidden')}>×</button>
    </div>
  );
}

function ProgressRing({ fraction }: { fraction: number }) {
  const radius = 11;
  const turn = 2 * Math.PI * radius;
  const filled = Math.max(0, Math.min(1, fraction)) * turn;
  return (
    <svg className="engage-ring" viewBox="0 0 28 28" aria-hidden="true">
      <circle cx="14" cy="14" r={radius} />
      <circle cx="14" cy="14" r={radius} strokeDasharray={`${filled} ${turn}`} />
    </svg>
  );
}
