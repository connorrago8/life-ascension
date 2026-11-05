'use client';

import { useEffect, useRef } from 'react';
import type { SampleQuest } from '../../lib/preview/sampleQuests';

export function QuestSheet({
  quest,
  completed,
  doneCount,
  total,
  onClose,
  onComplete,
}: {
  quest: SampleQuest;
  completed: boolean;
  doneCount: number;
  total: number;
  onClose: () => void;
  onComplete: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <button type="button" className="sheet-backdrop" aria-label="Close quest" onClick={onClose} />
      <div className="quest-sheet" role="dialog" aria-modal="true" aria-labelledby="quest-sheet-title">
        <div className="sheet-handle" aria-hidden="true" />
        <p className="sheet-kicker">Today's quest · {doneCount}/{total}</p>
        <h2 id="quest-sheet-title">{quest.title}</h2>
        <p>{quest.detail}</p>
        <p className="sheet-xp">+{quest.xp} XP</p>
        <p className="sheet-area">{quest.area} · Sample display</p>
        <div className="sheet-actions">
          {completed ? (
            <p className="sheet-done" role="status">Completed</p>
          ) : (
            <button type="button" className="sheet-action" onClick={onComplete}>
              Mark complete
            </button>
          )}
          <button ref={closeRef} type="button" className="sheet-ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </>
  );
}
