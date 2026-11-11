import { BOSS, foeById, ROOM_LABEL, roomTitle, type Room } from './floor.ts';

/**
 * Labels for the "Choose your path" screen. The option list and the map read
 * from this one helper, so the badge, the short map label and the accessible
 * name of each reachable node always match the list button that enters it.
 * Display only: it never changes rooms, rewards or the seed.
 */
export type PathOption = {
  index: number;
  /** A, B, C… shown on the list button and on its map node. */
  badge: string;
  /** "Fight", "Elite", "Treasure", "Event", "Campfire" or "Boss". */
  kind: string;
  /** Full room title, e.g. "Grave Bat". */
  title: string;
  /** Short label under the map node, e.g. "Grave Bat", "Elite: Ghoul", "Chest". */
  short: string;
  /** e.g. "Path A: Fight, Grave Bat". */
  ariaLabel: string;
};

export function pathBadge(index: number): string {
  return String.fromCharCode(65 + Math.max(0, Math.min(25, Math.floor(index))));
}

export function shortRoomLabel(room: Room, boss = false): string {
  if (boss) return `Boss: ${foeById(room.foeId ?? BOSS.id).name}`;
  if (room.kind === 'fight') return roomTitle(room);
  if (room.kind === 'elite') return `Elite: ${roomTitle(room)}`;
  if (room.kind === 'treasure') return 'Chest';
  if (room.kind === 'event') return 'Mystery';
  return 'Campfire';
}

export function pathOptions(rooms: readonly Room[], boss = false): PathOption[] {
  return rooms.map((room, index) => {
    const badge = pathBadge(index);
    const kind = boss ? 'Boss' : ROOM_LABEL[room.kind];
    const title = boss ? foeById(room.foeId ?? BOSS.id).name : roomTitle(room);
    return { index, badge, kind, title, short: shortRoomLabel(room, boss), ariaLabel: `Path ${badge}: ${kind}, ${title}` };
  });
}
