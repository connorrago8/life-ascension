const WALL = '#241430';
const WALL_ALT = '#1A0E22';
const MORTAR = '#100814';
const FLOOR = '#4A302C';
const FLOOR_ALT = '#2C1A22';
const MOSS = '#1E6A38';
const MOSS_LIGHT = '#3D9458';
const ARCH = '#07040C';
const PILLAR = '#3A2848';
const PILLAR_DARK = '#1A1028';
const TORCH = '#C45B28';
const FLAME = '#FFD27A';
const EMBER = '#FF8A2A';

function cellColor(x: number, y: number): string {
  const floorStart = 46;
  if (x < 5 || x > 54) {
    if (y > 50) return (x + y) % 2 === 0 ? FLOOR : FLOOR_ALT;
    return y % 5 === 0 ? PILLAR : PILLAR_DARK;
  }
  const dx = x - 30;
  const inArch = y > 14 && y < 42 && (dx * dx) / 70 + ((y - 40) * (y - 40)) / 90 < 1;
  if (inArch) return ARCH;
  if (y >= floorStart) {
    if ((x * 5 + y * 3) % 19 === 0) return MOSS;
    if ((x + y) % 23 === 0) return MOSS_LIGHT;
    const tile = Math.floor(x / 4) + Math.floor(y / 3);
    return tile % 2 === 0 ? FLOOR : FLOOR_ALT;
  }
  const brickRow = Math.floor(y / 4);
  const offset = brickRow % 2 === 0 ? 0 : 3;
  if (y % 4 === 0 || (x + offset) % 7 === 0) return MORTAR;
  return (brickRow + Math.floor(x / 7)) % 2 === 0 ? WALL : WALL_ALT;
}

const TORCHES = [
  { x: 10, y: 24 },
  { x: 48, y: 24 },
];

export function DungeonArt() {
  const tiles = [];
  for (let y = 0; y < 72; y += 1) {
    for (let x = 0; x < 60; x += 1) {
      tiles.push(<rect key={`${x}:${y}`} x={x} y={y} width={1} height={1} fill={cellColor(x, y)} />);
    }
  }
  return (
    <svg className="dungeon-art" viewBox="0 0 60 72" shapeRendering="crispEdges" aria-hidden="true">
      {tiles}
      {TORCHES.map((torch) => (
        <g key={`${torch.x}:${torch.y}`}>
          <rect x={torch.x} y={torch.y} width="2" height="6" fill="#5A3C2C" />
          <rect x={torch.x - 1} y={torch.y - 1} width="4" height="2" fill={TORCH} />
          <rect x={torch.x} y={torch.y - 3} width="2" height="2" fill={FLAME} />
          <rect x={torch.x} y={torch.y - 4} width="1" height="1" fill={EMBER} />
          <rect x={torch.x - 2} y={torch.y} width="1" height="1" fill={EMBER} opacity="0.8" />
          <rect x={torch.x + 3} y={torch.y + 1} width="1" height="1" fill={FLAME} opacity="0.7" />
        </g>
      ))}
      <rect x="18" y="58" width="3" height="2" fill="#6A5348" />
      <rect x="40" y="62" width="4" height="2" fill="#241610" />
      <rect x="22" y="66" width="2" height="1" fill={MOSS} />
    </svg>
  );
}
