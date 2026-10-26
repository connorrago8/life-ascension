'use client';

import { useEffect, useRef } from 'react';
import type { LevelUpView } from '../../lib/preview/progression';

export function LevelUpCelebration({ view, onSkip }: { view: LevelUpView; onSkip: () => void }) {
  const skipRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    skipRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onSkip();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onSkip]);

  const changed = view.stats.filter((stat) => stat.after !== stat.before);

  return (
    <div className="level-up" role="dialog" aria-modal="true" aria-labelledby="level-up-heading" data-level-up={view.level}>
      <div className="level-up-card">
        <p className="level-up-kicker">Level up</p>
        <h2 id="level-up-heading">LEVEL {view.level}</h2>
        <p className="level-up-name">{view.title}</p>
        <ul className="level-up-list">
          {changed.map((stat) => (
            <li key={stat.label}>{stat.label} {stat.before} → {stat.after}</li>
          ))}
          {view.unlocks.map((unlock) => (
            <li key={unlock}>{unlock}</li>
          ))}
        </ul>
        <button ref={skipRef} type="button" className="sheet-ghost" onClick={onSkip}>Skip</button>
      </div>
    </div>
  );
}
