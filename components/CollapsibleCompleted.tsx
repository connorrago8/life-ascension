'use client';

import { useState, type ReactNode } from 'react';

export function CollapsibleCompleted({
  count,
  children,
  storageKey = 'la.quests.completedOpen',
}: {
  count: number;
  children: ReactNode;
  storageKey?: string;
}) {
  const [open, setOpen] = useState(false);

  // Restore once on mount
  useState(() => {
    try {
      if (window.localStorage.getItem(storageKey) === '1') setOpen(true);
    } catch { /* stay collapsed */ }
    return false;
  });

  function toggle() {
    setOpen((v) => {
      const next = !v;
      try { window.localStorage.setItem(storageKey, next ? '1' : '0'); } catch { /* keep UI */ }
      return next;
    });
  }

  return (
    <section aria-label="Completed quests">
      <button
        type="button"
        className="cq-completed-toggle"
        aria-expanded={open}
        onClick={toggle}
      >
        <span>Completed ({count})</span>
        <span aria-hidden="true">{open ? '▾' : '▸'}</span>
      </button>
      {open && <div className="cq-done-panel is-open">{children}</div>}
    </section>
  );
}
