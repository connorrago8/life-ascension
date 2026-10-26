import { CRYPT_PALETTE } from '../../lib/crypt/art';

export function PixelArt({
  rows,
  label,
  className,
}: {
  rows: readonly string[];
  label?: string;
  className?: string;
}) {
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  const rects = [];
  for (let y = 0; y < rows.length; y += 1) {
    const row = rows[y];
    for (let x = 0; x < row.length; x += 1) {
      const fill = CRYPT_PALETTE[row[x]];
      if (!fill) continue;
      rects.push(<rect key={`${x}:${y}`} x={x} y={y} width={1} height={1} fill={fill} />);
    }
  }
  return (
    <svg
      className={className ? `pixel-sprite ${className}` : 'pixel-sprite'}
      viewBox={`0 0 ${width} ${height}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      shapeRendering="crispEdges"
    >
      {rects}
    </svg>
  );
}
