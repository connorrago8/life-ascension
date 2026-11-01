'use client';

import { useState } from 'react';

export type CurseRedemption = {
  id: string;
  questTitle: string;
  consequenceText: string;
  state: 'revealed';
};

type Action = 'fulfill' | 'decline' | 'forgive';

type Props = {
  curses: CurseRedemption[];
  onResolve: (id: string, action: Action) => Promise<void>;
};

/** Render only server-authorized revealed consequences. Never pass sealed text. */
export function IzzyCurseRedemptions({ curses, onResolve }: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);

  async function resolve(id: string, action: Action) {
    if (busyId) return;
    setBusyId(id);
    setErrorId(null);
    try {
      await onResolve(id, action);
    } catch {
      setErrorId(id);
    } finally {
      setBusyId(null);
    }
  }

  if (curses.length === 0) return null;

  return (
    <section aria-label="Queen Izzy's revealed decrees" className="space-y-3">
      <h2 className="text-lg font-semibold">👑 Queen Izzy's Decrees</h2>
      {curses.map((curse) => (
        <article key={curse.id} className="rounded-xl border border-amber-500/30 bg-slate-900 p-4 text-slate-100">
          <p className="text-xs text-amber-300">Revealed consequence · {curse.questTitle}</p>
          <p className="my-3">{curse.consequenceText}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busyId !== null}
              onClick={() => { void resolve(curse.id, 'fulfill'); }}
              className="rounded-lg bg-amber-300 px-3 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50">
              Completed
            </button>
            <button type="button" disabled={busyId !== null}
              onClick={() => { void resolve(curse.id, 'decline'); }}
              className="rounded-lg border border-slate-500 px-3 py-2 text-sm disabled:opacity-50">
              Decline
            </button>
          </div>
          {errorId === curse.id && <p role="alert" className="mt-2 text-sm text-rose-300">Couldn't save. Please try again.</p>}
        </article>
      ))}
    </section>
  );
}
