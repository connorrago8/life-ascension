'use client';
import { useState } from 'react';
import { DelveRun } from '../../../components/crypt/DelveRun';
import { ZERO_ATTRIBUTES } from '../../../lib/crypt/delve/stats';
import type { DelveState } from '../../../lib/crypt/delve/run';
const VAULT = ['rusty-shortsword', 'bone-cleaver', 'sentinel-plate', 'moth-ward'];
export function CryptCampQAHarness() {
  const [state, setState] = useState<DelveState | null>(null);
  return <>
    <p className="wrap">Local camp fixture · demonstration gear · no account saves</p>
    <DelveRun level={3} savedAttributes={ZERO_ATTRIBUTES} vaultItemIds={VAULT}
      keepNote="Demonstration gear for this local fixture; not saved to an account."
      exitHref="/play" saveMode="preview" onSaveAttributes={async () => false}
      onLoot={async () => false} onFloorCleared={async () => 'Local fixture only.'} onStateChange={setState} />
    <output aria-label="Fixture run state" style={{display:'block',whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(state)}</output>
  </>;
}
