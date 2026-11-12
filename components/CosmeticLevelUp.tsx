'use client';

import Link from 'next/link';
import { levelUpLines, type CosmeticBearer } from '../lib/levelUpCopy';

/** Cosmetic level-up. Aged-gold flash, no confetti, and nothing equips itself. */
export function CosmeticLevelUp({
  who,
  level,
  item,
  onClose,
  characterHref,
}: {
  who: CosmeticBearer;
  level: number;
  item: { id: string; label: string } | null;
  onClose: () => void;
  characterHref: string;
}) {
  const copy = levelUpLines(who, level, item);
  return (
    <div className="cosmetic-level-up" role="dialog" aria-modal="true" aria-labelledby="cosmetic-level-heading">
      <div className="cosmetic-level-card">
        <h2 id="cosmetic-level-heading">{copy.headline}</h2>
        <p>{copy.subhead}</p>
        <p>{copy.body}</p>
        {copy.gear && <p>{copy.gear}</p>}
        {copy.reveal && <p>{copy.reveal}</p>}
        {copy.awaiting && <p>{copy.awaiting}</p>}
        <div className="companion-actions">
          <Link className="btn" href={characterHref} onClick={onClose}>View Character</Link>
          <button className="btn ghost" type="button" onClick={onClose}>Keep Going</button>
        </div>
      </div>
    </div>
  );
}
