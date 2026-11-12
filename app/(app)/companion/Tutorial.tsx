'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

export type TutorialCard = {
  title: string;
  body: string;
  art?: ReactNode;
  nextLabel?: string;
  /** Skip ahead, used by the welcome primary action. */
  jumpTo?: number;
  secondary?: string;
  secondaryIndex?: number;
};

export function Tutorial({
  cards,
  onClose,
  onFinish,
  finishLabel,
  lastCard,
}: {
  cards: readonly TutorialCard[];
  onClose: () => void;
  onFinish: () => void;
  finishLabel: string;
  lastCard?: ReactNode;
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
        {card.art}
        <p>{card.body}</p>
        {last && lastCard}
        <div className="companion-actions">
          <button className="btn ghost" type="button" onClick={onClose}>Skip</button>
          {card.secondary && (
            <button className="btn ghost" type="button" onClick={() => setIndex(card.secondaryIndex ?? 1)}>{card.secondary}</button>
          )}
          {index > 0 && (
            <button className="btn ghost" type="button" onClick={() => setIndex((value) => value - 1)}>Back</button>
          )}
          {!(last && lastCard) && (
            <button
              className="btn"
              type="button"
              onClick={() => {
                if (card.jumpTo != null) setIndex(card.jumpTo);
                else if (last) onFinish();
                else setIndex((value) => value + 1);
              }}
            >
              {last ? finishLabel : card.nextLabel ?? 'Next'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
