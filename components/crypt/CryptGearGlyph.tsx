import type { LootSlot } from '../../lib/crypt/delve/loot';

/** Decorative slot emblem, not an item portrait, rarity or ownership indicator. */
export function CryptGearGlyph({ slot }: { slot: LootSlot }) {
  const shapes: Record<LootSlot, string> = {
    weapon: 'M19 3h6v6h-3v3h-3v3h-3v3h-3v3h-3v-3H7v-3h3v-3h3V9h3V6h3z M7 21h6v3h-3v5H5v-5h2z',
    helm: 'M10 5h12v3h4v14h-4v6h-5v-9h-2v9h-5v-6H6V8h4z',
    armor: 'M6 6h6v4h8V6h6l4 7-5 4v11H7V17l-5-4z',
    shield: 'M6 4h20v17l-4 5-6 4-6-4-4-5z',
  };
  return <svg viewBox="0 0 32 32" width="96" height="96" shapeRendering="crispEdges" aria-hidden="true" focusable="false" className="recap-gear-glyph">
    <path d={shapes[slot]} fill="#63716F" />
    <path d={slot === 'weapon' ? 'M19 6h3v3h-3v3h-3v3h-3v3h-3v-3h3v-3h3V9h3z'
      : slot === 'helm' ? 'M10 8h12v3H10z M9 14h14v3H9z'
      : slot === 'armor' ? 'M8 9h3v4h10V9h3v5h-3v10H11V14H8z'
      : 'M9 7h14v3H12v10H9z M14 13h4v8h-4z'} fill="#C9D2C3" />
  </svg>;
}
