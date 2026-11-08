'use client';

import { useEffect, useId, useRef, useState } from 'react';

export type TutorialCard = { title: string; body: string };

export function Tutorial({
  cards,
  onClose,
  onFinish,
  finishLabel,
}: {
  cards: readonly TutorialCard[];
  onClose: () => void;
  onFinish: () => void;
  finishLabel: string;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const card = cards[index];
  const last = index >= cards.length - 1;

  useEffect(() => {
    dialogRef.current?.querySelector<HTMLElement>('button')?.focus();
  }, [index]);

  return (
    <div className="companion-tutorial" role="presentation">
      <div
        ref={dialogRef}
        className="companion-tutorial-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <p className="eyebrow">How it works · {index + 1} of {cards.length}</p>
        <h2 id={titleId}>{card.title}</h2>
        <p>{card.body}</p>
        <div className="companion-actions">
          <button className="btn ghost" type="button" onClick={onClose}>Skip</button>
          {index > 0 && (
            <button className="btn ghost" type="button" onClick={() => setIndex((value) => value - 1)}>Back</button>
          )}
          <button className="btn" type="button" onClick={() => (last ? onFinish() : setIndex((value) => value + 1))}>
            {last ? finishLabel : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
