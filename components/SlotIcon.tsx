import type { SlotKey } from '../lib/equipment';
import { slotIconRows } from './slotIcons';

export function SlotIcon({ slot }: { slot: SlotKey }) {
  const rows = slotIconRows(slot);
  const rects = [];
  for (let y = 0; y < rows.length; y += 1) {
    const row = rows[y];
    for (let x = 0; x < row.length; x += 1) {
      if (row[x] !== '#') continue;
      rects.push(<rect key={`${x}:${y}`} x={x} y={y} width={1} height={1} fill="currentColor" />);
    }
  }
  return (
    <svg className="slot-icon" viewBox="0 0 16 16" aria-hidden="true" shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
      {rects}
    </svg>
  );
}
