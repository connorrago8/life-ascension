'use client';

import { useEffect, useState } from 'react';

export type RevealedCurse = {
  id: string;
  questTitle: string;
  consequenceText: string;
  /** Only the server may decide whether the reveal is newly available. */
  showReveal: boolean;
};

type Props = {
  curse: RevealedCurse | null;
  /** Persist acknowledgment server-side; do not rely on localStorage alone. */
  onAcknowledge: (curseId: string) => Promise<void>;
};

/**
 * Presentation only. Parent must obtain an authenticated, filtered payload
 * from a server endpoint. Never pass sealed curse text into client props.
 */
export function IzzyCurseReveal({ curse, onAcknowledge }: Props) {
  const [acknowledging, setAcknowledging] = useState(false);
  const [dismissedId, setDismissedId] = useState<string | null>(null);

  useEffect(() => {
    setDismissedId(null);
    setAcknowledging(false);
  }, [curse?.id]);

  if (!curse || !curse.showReveal || dismissedId === curse.id) return null;

  async function dismiss() {
    if (!curse || acknowledging) return;
    setAcknowledging(true);
    try {
      await onAcknowledge(curse.id);
      setDismissedId(curse.id);
    } catch {
      // Keep the card visible if acknowledgment was not persisted.
      setAcknowledging(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="izzy-curse-title"
        aria-describedby="izzy-curse-description"
        className="w-full max-w-sm rounded-2xl border border-amber-500/40 bg-slate-950 p-6 text-slate-100 shadow-xl"
      >
        <p className="mb-2 text-sm text-amber-300">👑 A decree from Queen Izzy</p>
        <h2 id="izzy-curse-title" className="mb-3 text-xl font-semibold">A Secret Curse has been revealed</h2>
        <p className="mb-3 text-sm text-slate-300">Missed quest: {curse.questTitle}</p>
        <p id="izzy-curse-description" className="mb-5 rounded-xl bg-slate-800 p-4 text-base">
          {curse.consequenceText}
        </p>
        <p className="mb-4 text-xs text-slate-400">
          A playful agreement, not an obligation. You can decline or ask Izzy for mercy.
        </p>
        <button
          type="button"
          disabled={acknowledging}
          onClick={() => { void dismiss(); }}
          className="w-full rounded-xl bg-amber-400 px-4 py-3 font-semibold text-slate-950 disabled:opacity-60"
        >
          {acknowledging ? 'Saving…' : 'Got it 💜'}
        </button>
      </section>
    </div>
  );
}
