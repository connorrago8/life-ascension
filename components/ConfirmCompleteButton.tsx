'use client';
import { useEffect, useState } from 'react';

type Props = { label: string; questTitle: string; disabled: boolean; onConfirm: () => void };

/**
 * In-app two-step confirmation (replaces the native window.confirm sheet).
 * First tap arms the button; a second tap within a few seconds confirms.
 * This only gates the UI: the caller keeps its own in-flight lock, and the
 * server's existing completion RPC remains the only +1 XP source.
 */
export function ConfirmCompleteButton({ label, questTitle, disabled, onConfirm }: Props) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const timer = window.setTimeout(() => setArmed(false), 4000);
    return () => window.clearTimeout(timer);
  }, [armed]);
  useEffect(() => { if (disabled) setArmed(false); }, [disabled]);
  return <button
    type="button"
    className={'btn' + (armed ? ' confirm-armed' : '')}
    disabled={disabled}
    aria-label={armed ? `Tap again to confirm you completed ${questTitle}` : `${label} ${questTitle}`}
    onClick={() => {
      if (disabled) return;
      if (!armed) { setArmed(true); return; }
      setArmed(false);
      onConfirm();
    }}
  >{armed ? 'Tap again to confirm' : label}</button>;
}
