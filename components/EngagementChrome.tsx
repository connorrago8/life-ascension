'use client';

import '../app/engagement.css';
import { InstallHint } from './InstallHint';
import { PushBridge } from './PushBridge';
import { StatusPill } from './StatusPill';

type Mode = 'companion' | 'adventurer' | 'signed-out';

/** Install hint and push bridge. The status pill mounts once, in the nav slot. */
export function EngagementChrome({ mode, showPill = true }: { mode: Mode; showPill?: boolean }) {
  return (
    <>
      <InstallHint />
      {showPill && mode !== 'signed-out' && <StatusPill mode={mode} />}
      <PushBridge enabled={mode !== 'signed-out'} />
    </>
  );
}
