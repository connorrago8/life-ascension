import { layerRows, PALETTE, SPRITE_HEIGHT, SPRITE_LAYER_IDS, SPRITE_WIDTH, type SpriteLayerId } from './spriteArt';

function Pixels({ rows, palette }: { rows: string[]; palette: Record<string, string> }) {
  const rects = [];
  for (let y = 0; y < rows.length; y += 1) {
    const row = rows[y];
    for (let x = 0; x < row.length; x += 1) {
      const fill = palette[row[x]];
      if (!fill) continue;
      rects.push(<rect key={`${x}:${y}`} x={x} y={y} width={1} height={1} fill={fill} />);
    }
  }
  return rects;
}

/**
 * Layered adventurer. The body wears beginner clothes.
 * Each equipment slot is its own group so future gear can paint on top.
 */
export function AdventurerSprite({
  label,
  overlays,
  palette = PALETTE,
}: {
  label?: string;
  overlays?: Partial<Record<SpriteLayerId, string[]>>;
  /** Defaults to the beginner palette. Previews pass a shared appearance palette. */
  palette?: Record<string, string>;
}) {
  return (
    <svg
      className="pixel-sprite"
      viewBox={`0 0 ${SPRITE_WIDTH} ${SPRITE_HEIGHT}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      shapeRendering="crispEdges"
      style={{ imageRendering: 'pixelated' }}
    >
      {SPRITE_LAYER_IDS.map((id) => (
        <g key={id} data-layer={id}>
          <Pixels rows={layerRows(id)} palette={palette} />
          {overlays?.[id] ? <Pixels rows={overlays[id]} palette={palette} /> : null}
        </g>
      ))}
    </svg>
  );
}
