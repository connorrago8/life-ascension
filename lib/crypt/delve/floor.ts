import type { Foe, Intent } from './battle.ts';
import { nextIndex, nextRoll, type Rng } from './rng.ts';
import type { AttributeKey } from './stats.ts';

/** Floor 1 of the Forgotten Crypt (World 1: Shattered Vale). */
export const FLOOR_ROWS = 12;
export const FLOOR_NAME = 'Forgotten Crypt · Floor 1';

export type RoomKind = 'fight' | 'elite' | 'treasure' | 'event' | 'rest';
export type Room = { kind: RoomKind; foeId?: string; eventId?: string };

/**
 * Slay the Spire pacing. Each row is one stop on your path (12 rows + the boss = 13 encounters).
 *   combat: every choice is a fight (you pick which monster)
 *   elite:  every choice is an elite (row 6)
 *   risky:  elite or a normal fight (row 9)
 *   free:   a mix of fights, events, treasure and a campfire
 *   camp:   campfire or treasure right before the boss
 * Any path therefore has at least 8 fights + 1 boss out of 13 (69%) and 1–2 elites.
 */
export type RowPlan = 'combat' | 'elite' | 'risky' | 'free' | 'camp';
export const ROW_PLAN: readonly RowPlan[] = [
  'combat', 'combat', 'free', 'combat', 'combat', 'free',
  'elite', 'combat', 'free', 'risky', 'combat', 'camp',
];

/** Global tuning knobs, checked by scripts/simulate-crypt-delve.mjs. */
export const HP_SCALE = 1.55;
export const ATTACK_SCALE = 1;
/** Extra foe HP per row deeper into the floor. */
export const ROW_HP_GROWTH = 0.04;
const atk = (value: number, label?: string, hits?: number): Intent => ({ kind: 'attack', value: Math.round(value * ATTACK_SCALE), label, hits });
const guard = (value: number): Intent => ({ kind: 'guard', value });
const roar = (value: number): Intent => ({ kind: 'roar', value });

type FoeTemplate = Omit<Foe, 'hp'>;

export const FOES: readonly FoeTemplate[] = [
  { id: 'crypt-rat', name: 'Crypt Rat', type: 'rot', sprite: 'rat', rank: 'normal', maxHp: 20,
    intents: [atk(5), atk(4, 'Nibble', 2), atk(9, 'Lunge')] },
  { id: 'grave-bat', name: 'Grave Bat', type: 'shadow', sprite: 'bat', rank: 'normal', maxHp: 16,
    intents: [atk(3, 'Flutter', 3), atk(6), roar(2)] },
  { id: 'restless-skeleton', name: 'Restless Skeleton', type: 'bone', sprite: 'skull', rank: 'normal', maxHp: 26,
    intents: [atk(6), guard(8), atk(11, 'Bone crush')] },
  { id: 'lost-wisp', name: 'Lost Wisp', type: 'spirit', sprite: 'wisp', rank: 'normal', maxHp: 18,
    intents: [atk(4, 'Chill', 2), guard(6), atk(9, 'Wail')] },
  { id: 'ember-imp', name: 'Ember Imp', type: 'flame', sprite: 'imp', rank: 'normal', maxHp: 19,
    intents: [atk(4, 'Cinders', 2), atk(8, 'Flare'), roar(1)] },
  { id: 'ghoul', name: 'Hungry Ghoul', type: 'rot', sprite: 'ghoul', rank: 'normal', maxHp: 32,
    intents: [atk(7), roar(2), atk(12, 'Rend'), guard(6)] },
  { id: 'stone-gargoyle', name: 'Stone Gargoyle', type: 'stone', sprite: 'golem', rank: 'normal', maxHp: 28,
    intents: [guard(10), atk(10, 'Dive'), atk(6)] },
  { id: 'bone-knight', name: 'Bone Knight', type: 'bone', sprite: 'knight', rank: 'elite', maxHp: 52,
    intents: [guard(12), atk(14, 'Cleave'), atk(5, 'Jab', 2), roar(3)] },
  { id: 'crypt-golem', name: 'Crypt Golem', type: 'stone', sprite: 'golem', rank: 'elite', maxHp: 60,
    intents: [guard(14), atk(16, 'Crush'), roar(2), atk(7, 'Pummel', 2)] },
];

const EARLY_FOES = ['crypt-rat', 'grave-bat', 'restless-skeleton', 'lost-wisp', 'ember-imp'];
const LATE_FOES = ['restless-skeleton', 'lost-wisp', 'ember-imp', 'ghoul', 'stone-gargoyle', 'grave-bat'];
const ELITES = ['bone-knight', 'crypt-golem'];

export const BOSS: FoeTemplate = {
  id: 'hollow-warden', name: 'The Hollow Warden', type: 'spirit', sprite: 'warden', rank: 'boss', maxHp: 105,
  intents: [atk(8), guard(14), atk(15, 'Grave slam'), roar(2)],
  enragedIntents: [atk(6, 'Soul lash', 3), atk(18, 'Grave slam'), guard(12), atk(10)],
};

/** Enemies get a little tougher deeper in the floor. */
export function spawnFoe(id: string, row: number): Foe {
  const template = id === BOSS.id ? BOSS : FOES.find((entry) => entry.id === id) ?? FOES[0];
  const scale = HP_SCALE * (template.rank === 'boss' ? 1 : 1 + Math.max(0, row) * ROW_HP_GROWTH);
  const maxHp = Math.round(template.maxHp * scale);
  return { ...template, maxHp, hp: maxHp };
}

export function foeById(id: string | undefined): FoeTemplate {
  if (id === BOSS.id) return BOSS;
  return FOES.find((entry) => entry.id === id) ?? FOES[0];
}

export type EventOption = {
  id: string;
  label: string;
  /** Stat check: success chance comes from this attribute. */
  check?: AttributeKey;
  success: EventOutcome;
  failure?: EventOutcome;
};
export type EventOutcome = { text: string; hp?: number; healPercent?: number; strength?: number; loot?: boolean };
export type CryptEvent = { id: string; title: string; prose: string; options: readonly EventOption[] };

export const EVENTS: readonly CryptEvent[] = [
  {
    id: 'collapsed-passage',
    title: 'Collapsed passage',
    prose: 'Fallen stones block a side passage. Something glints behind them.',
    options: [
      { id: 'heave', label: 'Heave the stones', check: 'strength',
        success: { text: 'The stones shift. You pull a prize from the rubble.', loot: true },
        failure: { text: 'A stone slips and crushes your hand.', hp: -6 } },
      { id: 'leave', label: 'Leave it', success: { text: 'You move on carefully.' } },
    ],
  },
  {
    id: 'whispering-shrine',
    title: 'Whispering shrine',
    prose: 'A cracked shrine hums with old warmth. It asks for something.',
    options: [
      { id: 'pray', label: 'Pray (heal 30%)', success: { text: 'Warmth closes your wounds.', healPercent: 0.3 } },
      { id: 'blood', label: 'Offer blood (−6 HP, +2 STR this run)', success: { text: 'The shrine drinks. Your arm feels stronger.', hp: -6, strength: 2 } },
    ],
  },
  {
    id: 'riddle-door',
    title: 'Riddle door',
    prose: 'A face carved in a door asks a riddle about a key that is never a key.',
    options: [
      { id: 'answer', label: 'Answer the riddle', check: 'intelligence',
        success: { text: '"A promise," you say. The door slides open on a small cache.', loot: true },
        failure: { text: 'The face says nothing. The door stays shut.' } },
      { id: 'leave', label: 'Walk past', success: { text: 'You leave the riddle unanswered.' } },
    ],
  },
  {
    id: 'tripwire-hall',
    title: 'Tripwire hall',
    prose: 'Thin wires cross a long hall at ankle height. One step at a time…',
    options: [
      { id: 'careful', label: 'Step lightly', check: 'agility',
        success: { text: 'You cross cleanly and salvage a trap part.', loot: true },
        failure: { text: 'Snap. A dart grazes your leg.', hp: -5 } },
      { id: 'run', label: 'Sprint through (−3 HP)', success: { text: 'You get nicked, but you are through.', hp: -3 } },
    ],
  },
  {
    id: 'bone-dice',
    title: 'Bone dice',
    prose: 'A skeleton slumps over a game it never finished. Its dice are still warm.',
    options: [
      { id: 'roll', label: 'Roll the bones', check: 'luck',
        success: { text: 'Sixes! The skeleton\'s purse is yours.', loot: true },
        failure: { text: 'Snake eyes. The skeleton\'s hand snaps shut on yours.', hp: -4 } },
      { id: 'leave', label: 'Let it rest', success: { text: 'You leave the game unfinished.' } },
    ],
  },
  {
    id: 'still-pool',
    title: 'Still pool',
    prose: 'Dark water reflects a version of you that looks well rested.',
    options: [
      { id: 'drink', label: 'Drink deeply', check: 'endurance',
        success: { text: 'Cold and clean. You feel restored.', healPercent: 0.4 },
        failure: { text: 'It tastes of iron. Your stomach turns.', hp: -5 } },
      { id: 'leave', label: 'Leave it', success: { text: 'You leave the water still.' } },
    ],
  },
];

export function eventById(id: string | undefined): CryptEvent {
  return EVENTS.find((item) => item.id === id) ?? EVENTS[0];
}

function pickDistinct(rng: Rng, pool: readonly string[], count: number): [string[], Rng] {
  const open = pool.slice();
  const picks: string[] = [];
  let state = rng;
  while (picks.length < count && open.length > 0) {
    const [index, next] = nextIndex(state, open.length);
    state = next;
    picks.push(open.splice(index, 1)[0]);
  }
  return [picks, state];
}

function pickEvent(rng: Rng, usedEvents: Set<string>): [Room, Rng] {
  const open = EVENTS.filter((item) => !usedEvents.has(item.id));
  const pool = open.length > 0 ? open : EVENTS;
  const [index, next] = nextIndex(rng, pool.length);
  usedEvents.add(pool[index].id);
  return [{ kind: 'event', eventId: pool[index].id }, next];
}

function freeRow(rng: Rng, row: number, usedEvents: Set<string>): [Room[], Rng] {
  let state = rng;
  const [[foeId], afterFoe] = pickDistinct(state, row < 4 ? EARLY_FOES : LATE_FOES, 1);
  state = afterFoe;
  const [event, afterEvent] = pickEvent(state, usedEvents);
  state = afterEvent;
  const [roll, afterRoll] = nextRoll(state);
  state = afterRoll;
  // Mid-floor campfire on row 5; otherwise treasure or a fight to pick from.
  const third: Room = row === 5 ? { kind: 'rest' } : roll < 0.6 ? { kind: 'treasure' } : { kind: 'fight', foeId };
  const rooms: Room[] = [event, third];
  if (third.kind !== 'fight') rooms.unshift({ kind: 'fight', foeId });
  return [rooms, state];
}

/**
 * Build the floor: FLOOR_ROWS rows of 2–3 room choices (see ROW_PLAN), then the boss.
 * You pick one room per row, so every run takes a different path.
 */
export function generateFloor(seed: Rng): { rows: Room[][]; rng: Rng } {
  let rng = seed;
  const rows: Room[][] = [];
  const usedEvents = new Set<string>();
  for (let row = 0; row < FLOOR_ROWS; row += 1) {
    const plan = ROW_PLAN[row] ?? 'combat';
    if (plan === 'camp') {
      rows.push([{ kind: 'rest' }, { kind: 'treasure' }]);
      continue;
    }
    if (plan === 'free') {
      const [rooms, next] = freeRow(rng, row, usedEvents);
      rng = next;
      rows.push(rooms);
      continue;
    }
    if (plan === 'elite') {
      const [ids, next] = pickDistinct(rng, ELITES, 2);
      rng = next;
      rows.push(ids.map((foeId) => ({ kind: 'elite', foeId })));
      continue;
    }
    const [countRoll, afterCount] = nextRoll(rng);
    rng = afterCount;
    const count = plan === 'risky' ? 1 : countRoll < 0.45 ? 2 : 3;
    const [ids, next] = pickDistinct(rng, row < 4 ? EARLY_FOES : LATE_FOES, count);
    rng = next;
    const rooms: Room[] = ids.map((foeId) => ({ kind: 'fight', foeId }));
    if (plan === 'risky') {
      const [[eliteId], afterElite] = pickDistinct(rng, ELITES, 1);
      rng = afterElite;
      rooms.unshift({ kind: 'elite', foeId: eliteId });
    }
    rows.push(rooms);
  }
  return { rows, rng };
}

/** Encounters on any path: one room per row plus the boss. */
export const ENCOUNTERS_PER_RUN = FLOOR_ROWS + 1;

export const ROOM_LABEL: Record<RoomKind, string> = {
  fight: 'Fight', elite: 'Elite', treasure: 'Treasure', event: 'Event', rest: 'Campfire',
};

export function roomTitle(room: Room): string {
  if (room.kind === 'fight' || room.kind === 'elite') return foeById(room.foeId).name;
  if (room.kind === 'event') return eventById(room.eventId).title;
  if (room.kind === 'treasure') return 'Old chest';
  return 'Campfire';
}

export function roomHint(room: Room): string {
  if (room.kind === 'fight') return 'A monster. Card reward, 40% gear chance.';
  if (room.kind === 'elite') return 'Tough monster. Card reward and better gear.';
  if (room.kind === 'treasure') return 'Guaranteed gear.';
  if (room.kind === 'event') return 'A choice. Your quest stats change the odds.';
  return 'Heal 35% of your HP.';
}

export const REST_HEAL = 0.35;

/** Odds of passing an event stat check; shown on the button before you choose. */
export function checkChance(points: number): number {
  return Math.min(0.95, 0.3 + Math.max(0, points) * 0.04);
}
