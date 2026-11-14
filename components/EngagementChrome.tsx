'use client';

import '../app/engagement.css';
import { InstallHint } from './InstallHint';
import { PushBridge } from './PushBridge';
import { StatusPill } from './StatusPill';

type Mode = 'companion' | 'adventurer' | 'signed-out';

/** Self-contained mount for the status pill, install hint, and push bridge. */
export function EngagementChrome({ mode }: { mode: Mode }) {
  return (
    <>
      <InstallHint />
      {mode !== 'signed-out' && <StatusPill mode={mode} />}
      <PushBridge enabled={mode !== 'signed-out'} />
    </>
  );
}
