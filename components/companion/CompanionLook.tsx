'use client';

import { PixelAvatar } from '../PixelAvatar';

const LAYER: Record<string, string> = {
  ribbon: 'ribbon',
  'black-shirt': 'shirt',
  'lantern-pin': 'pin',
  'cat-ears': 'ears',
  princess: 'gown',
};

/** Cosmetic layers on Izzy's portrait. They do not change quests, XP, or combat. */
export function CompanionLook({ worn, size = 96 }: { worn: readonly string[]; size?: number }) {
  return (
    <div className="companion-look" style={{ width: size, height: size }}>
      <PixelAvatar who="izzy" size={size} alt="Izzy, a pixel princess with a silver tiara" />
      {worn.map((id) => (
        LAYER[id] ? <span key={id} className={`companion-layer layer-${LAYER[id]}`} aria-hidden="true" /> : null
      ))}
    </div>
  );
}
