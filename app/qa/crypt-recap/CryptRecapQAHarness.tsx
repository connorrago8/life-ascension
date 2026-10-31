'use client';

import { useEffect, useState } from 'react';
import { RunRecapView } from '../../../components/crypt/RunRecap';
import type { RunRecap, SaveMode } from '../../../lib/crypt/delve/recap';

/** Synthetic recaps (local only). ?view=victory|defeat&mode=vault|visit|preview */
const VICTORY: RunRecap = {
  runId: '00000000-0000-4000-a000-00000000a001', result: 'conquered', floor: 1, roomsCleared: 13, roomsVisited: 13, roomsTotal: 13,
  fellTo: null, bossReward: 'warden-glaive', found: ['rusty-shortsword', 'warden-glaive'],
};
const DEFEAT: RunRecap = {
  runId: '00000000-0000-4000-a000-00000000a002', result: 'fallen', floor: 1, roomsCleared: 6, roomsVisited: 7, roomsTotal: 13,
  fellTo: 'Restless Skeleton', bossReward: null, found: ['rusty-shortsword'],
};

export function CryptRecapQAHarness() {
  const [params, setParams] = useState<{ view: string; mode: SaveMode } | null>(null);
  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const mode = search.get('mode');
    setParams({ view: search.get('view') ?? 'victory', mode: mode === 'visit' || mode === 'preview' ? mode : 'vault' });
  }, []);
  if (!params) return null;
  const recap = params.view === 'defeat' ? DEFEAT : VICTORY;
  return (
    <main className="wrap delve" aria-label="Crypt recap QA (local only)">
      <RunRecapView recap={recap} mode={params.mode} confirmed={recap.found.length}
        checkpoint={recap.result === 'conquered' ? 'Checkpoint saved: Floor 1 cleared.' : null}
        onContinue={() => {}} exitHref="/play" />
    </main>
  );
}
