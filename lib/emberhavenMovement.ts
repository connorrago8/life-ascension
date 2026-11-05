export type TownPoint = { x: number; y: number };
export type TownDirection = 'north' | 'south' | 'east' | 'west';
export type TownObstacle = { x: number; y: number; radius: number };

export const TOWN_STEP = 8;
export const TOWN_BOUNDS = { min: 8, max: 92 } as const;
export const TOWN_OBSTACLES: readonly TownObstacle[] = [
  { x: 35, y: 22, radius: 8 },
  { x: 64, y: 21, radius: 8 },
  { x: 10, y: 51, radius: 6 },
  { x: 90, y: 52, radius: 6 },
];

export function townDistance(a: TownPoint, b: TownPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function canOccupyTownPoint(point: TownPoint): boolean {
  if (point.x < TOWN_BOUNDS.min || point.x > TOWN_BOUNDS.max ||
      point.y < TOWN_BOUNDS.min || point.y > TOWN_BOUNDS.max) return false;
  return !TOWN_OBSTACLES.some((obstacle) => townDistance(point, obstacle) < obstacle.radius);
}

export function walkTown(position: TownPoint, direction: TownDirection): TownPoint {
  const delta = {
    north: { x: 0, y: -TOWN_STEP },
    south: { x: 0, y: TOWN_STEP },
    east: { x: TOWN_STEP, y: 0 },
    west: { x: -TOWN_STEP, y: 0 },
  }[direction];
  const next = {
    x: Math.max(TOWN_BOUNDS.min, Math.min(TOWN_BOUNDS.max, position.x + delta.x)),
    y: Math.max(TOWN_BOUNDS.min, Math.min(TOWN_BOUNDS.max, position.y + delta.y)),
  };
  if (next.x === position.x && next.y === position.y) return position;
  return canOccupyTownPoint(next) ? next : position;
}
