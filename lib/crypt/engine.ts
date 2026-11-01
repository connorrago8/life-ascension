import { rollAt } from './rng.ts';

/** Extra damage is 0, 1, or 2, taken from a roll in [0, 1). */
export const ATTACK_SPREAD = 3;
export const HEAVY_COOLDOWN = 2;
export const FOCUS_MULTIPLIER = 2;

export const ACTION_IDS = ['attack', 'defend', 'heavy', 'focus'] as const;
export type ActionId = (typeof ACTION_IDS)[number];

export type Combatant = {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  attack: number;
};

export type PlayerState = Combatant & {
  heavy: number;
  attackBonus: number;
};

export type RngState =
  | { kind: 'seed'; seed: number; cursor: number }
  | { kind: 'script'; rolls: readonly number[]; cursor: number };

export type BattleStatus = 'ongoing' | 'won' | 'lost';

export type BattleState = {
  rng: RngState;
  turn: number;
  player: PlayerState;
  enemy: Combatant;
  /** The next Attack is doubled. Heavy Strike does not consume this. */
  focused: boolean;
  /** Turns that must pass before Heavy Strike can be used again. */
  heavyCooldown: number;
  status: BattleStatus;
  log: string[];
};

export function rolledDamage(base: number, roll: number): number {
  const unit = Math.min(0.999999, Math.max(0, roll));
  return base + Math.floor(unit * ATTACK_SPREAD);
}

/** Defend halves the incoming hit, rounding up so a hit still lands. */
export function halvedDamage(amount: number): number {
  return Math.ceil(amount / 2);
}

function isAction(value: string): value is ActionId {
  return (ACTION_IDS as readonly string[]).includes(value);
}

function draw(rng: RngState): { roll: number; rng: RngState } {
  if (rng.kind === 'script') {
    const roll = rng.rolls[rng.cursor] ?? 0;
    return { roll, rng: { kind: 'script', rolls: rng.rolls, cursor: rng.cursor + 1 } };
  }
  return {
    roll: rollAt(rng.seed, rng.cursor),
    rng: { kind: 'seed', seed: rng.seed, cursor: rng.cursor + 1 },
  };
}

export function createBattle(input: {
  seed?: number;
  script?: readonly number[];
  player: PlayerState;
  enemy: Combatant;
}): BattleState {
  const rng: RngState = input.script
    ? { kind: 'script', rolls: input.script.slice(), cursor: 0 }
    : { kind: 'seed', seed: Math.floor(input.seed ?? 1) || 1, cursor: 0 };
  return {
    rng,
    turn: 1,
    player: { ...input.player },
    enemy: { ...input.enemy },
    focused: false,
    heavyCooldown: 0,
    status: 'ongoing',
    log: [],
  };
}

export function availableActions(state: BattleState): ActionId[] {
  if (state.status !== 'ongoing') return [];
  return ACTION_IDS.filter((id) => id !== 'heavy' || state.heavyCooldown === 0);
}

/**
 * Resolve one player action, then the enemy's hit if it is still standing.
 * Defend halves that hit. Focus doubles the next Attack only.
 * Heavy Strike is stronger and then waits HEAVY_COOLDOWN turns.
 */
export function act(state: BattleState, action: ActionId): BattleState {
  if (state.status !== 'ongoing') return state;
  if (!isAction(action)) return state;
  if (action === 'heavy' && state.heavyCooldown > 0) return state;

  let rng = state.rng;
  let player = { ...state.player };
  let enemy = { ...state.enemy };
  let focused = state.focused;
  let heavyCooldown = state.heavyCooldown;
  const log = state.log.slice();

  if (action === 'attack' || action === 'heavy') {
    const drawn = draw(rng);
    rng = drawn.rng;
    const base = (action === 'heavy' ? player.heavy : player.attack) + player.attackBonus;
    let damage = rolledDamage(base, drawn.roll);
    const focusedHit = action === 'attack' && focused;
    if (focusedHit) {
      damage *= FOCUS_MULTIPLIER;
      focused = false;
    }
    enemy = { ...enemy, hp: Math.max(0, enemy.hp - damage) };
    if (action === 'heavy') {
      heavyCooldown = HEAVY_COOLDOWN;
      log.push(`${player.name} lands a heavy strike for ${damage}.`);
    } else if (focusedHit) {
      log.push(`${player.name} lands a focused strike for ${damage}.`);
    } else {
      log.push(`${player.name} strikes for ${damage}.`);
    }
  } else if (action === 'defend') {
    log.push(`${player.name} braces. The next hit will be halved.`);
  } else {
    focused = true;
    log.push(`${player.name} focuses. The next Attack will hit twice as hard.`);
  }

  if (action !== 'heavy' && heavyCooldown > 0) heavyCooldown -= 1;

  let status: BattleStatus = 'ongoing';
  if (enemy.hp <= 0) {
    status = 'won';
    log.push(`${enemy.name} is defeated.`);
  } else {
    const drawn = draw(rng);
    rng = drawn.rng;
    const raw = rolledDamage(enemy.attack, drawn.roll);
    const damage = action === 'defend' ? halvedDamage(raw) : raw;
    player = { ...player, hp: Math.max(0, player.hp - damage) };
    log.push(
      action === 'defend'
        ? `${enemy.name} hits for ${raw}, halved to ${damage}.`
        : `${enemy.name} hits for ${damage}.`,
    );
    if (player.hp <= 0) {
      status = 'lost';
      log.push(`${player.name} falls.`);
    }
  }

  return {
    rng,
    turn: status === 'ongoing' ? state.turn + 1 : state.turn,
    player,
    enemy,
    focused,
    heavyCooldown,
    status,
    log,
  };
}
