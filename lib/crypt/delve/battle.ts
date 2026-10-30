import {
  CARDS, strengthBonus, luckBonus, EFFECTIVE_MULTIPLIER, RESISTED_MULTIPLIER, cardBlock, cardHeal, cardHitDamage, cardPoison,
  cardWeak, effectiveness, type CardDef, type CardId, type MonsterType,
} from './cards.ts';
import { nextIndex, nextRoll, type Rng } from './rng.ts';
import { critChance, dodgeChance, type Attributes } from './stats.ts';

/**
 * Card combat (Slay the Spire style) against a single monster (Pokémon style).
 * The foe's next move is always shown. Nothing happens without a tap: there are
 * no timers, so a hidden or backgrounded tab can never lose a fight.
 */
export const ENERGY_PER_TURN = 3;
export const HAND_SIZE = 5;
export const CRIT_MULTIPLIER = 2;
export const VULNERABLE_MULTIPLIER = 1.5;
export const WEAK_MULTIPLIER = 0.75;
export const MAX_HAND = 10;

export type Intent =
  | { kind: 'attack'; value: number; hits?: number; label?: string }
  | { kind: 'guard'; value: number }
  | { kind: 'roar'; value: number };

export type Foe = {
  id: string;
  name: string;
  type: MonsterType;
  sprite: 'rat' | 'bat' | 'skull' | 'ghoul' | 'wisp' | 'knight' | 'warden' | 'imp' | 'golem';
  rank: 'normal' | 'elite' | 'boss';
  hp: number;
  maxHp: number;
  intents: readonly Intent[];
  /** Boss pattern once it drops to half health. */
  enragedIntents?: readonly Intent[];
};

export type CardInstance = { uid: number; id: CardId };

export type FoeState = Foe & { block: number; strength: number; vulnerable: number; weak: number; poison: number };

export type Feedback = {
  /** Increments every resolved card or enemy turn so the UI can replay its animation. */
  seq: number;
  dealt: number | null;
  taken: number | null;
  blocked: number | null;
  healed: number | null;
  crit: boolean;
  effect: 'super' | 'resisted' | 'normal' | null;
};

export type Battle = {
  rng: Rng;
  turn: number;
  step: number;
  enraged: boolean;
  attributes: Attributes;
  hp: number;
  maxHp: number;
  block: number;
  energy: number;
  focused: boolean;
  /** Battle Cry stacks: bonus damage on every attack hit this fight. */
  might: number;
  /** Sidestep: the next enemy hit misses. */
  dodgeNext: boolean;
  /** Loaded Dice: the next attack hit crits. */
  critNext: boolean;
  /** Cards played this turn (Momentum). */
  played: number;
  drawPile: CardInstance[];
  hand: CardInstance[];
  discard: CardInstance[];
  exhausted: CardInstance[];
  foe: FoeState;
  status: 'ongoing' | 'won' | 'lost';
  log: string[];
  feedback: Feedback;
};

/** AGI gives a 4% chance per point (max 60%) to draw a sixth card each turn. */
export function extraDrawChance(attributes: Attributes): number {
  return Math.min(0.6, Math.max(0, attributes.agility) * 0.04);
}

/** Cards drawn this turn: 5, plus one more if the AGI roll lands. */
function rollDrawCount(battle: Battle): [number, Rng] {
  const [roll, rng] = nextRoll(battle.rng);
  return [HAND_SIZE + (roll < extraDrawChance(battle.attributes) ? 1 : 0), rng];
}

/** AGI 3+ strikes first with +1 energy on turn 1; AGI 10+ keeps that bonus every turn. */
export function energyForTurn(attributes: Attributes, turn: number): number {
  if (attributes.agility >= 10) return ENERGY_PER_TURN + 1;
  if (turn === 1 && attributes.agility >= 3) return ENERGY_PER_TURN + 1;
  return ENERGY_PER_TURN;
}

function shuffle(cards: CardInstance[], rng: Rng): [CardInstance[], Rng] {
  const result = cards.slice();
  let state = rng;
  for (let i = result.length - 1; i > 0; i -= 1) {
    const [j, next] = nextIndex(state, i + 1);
    state = next;
    [result[i], result[j]] = [result[j], result[i]];
  }
  return [result, state];
}

function drawCards(battle: Battle, count: number): Battle {
  let { drawPile, discard, rng } = battle;
  const hand = battle.hand.slice();
  drawPile = drawPile.slice();
  for (let i = 0; i < count && hand.length < MAX_HAND; i += 1) {
    if (drawPile.length === 0) {
      if (discard.length === 0) break;
      [drawPile, rng] = shuffle(discard, rng);
      discard = [];
    }
    hand.push(drawPile.shift() as CardInstance);
  }
  return { ...battle, drawPile, discard, hand, rng };
}

export function startBattle(input: {
  rng: Rng; deck: readonly CardId[]; attributes: Attributes; hp: number; maxHp: number; foe: Foe;
}): Battle {
  const cards = input.deck.map((id, uid) => ({ uid, id }));
  const [drawPile, rng] = shuffle(cards, input.rng);
  const battle: Battle = {
    rng, turn: 1, step: 0, enraged: false, attributes: input.attributes,
    hp: input.hp, maxHp: input.maxHp, block: 0, energy: energyForTurn(input.attributes, 1), focused: false,
    might: 0, dodgeNext: false, critNext: false, played: 0,
    drawPile, hand: [], discard: [], exhausted: [],
    foe: { ...input.foe, block: 0, strength: 0, vulnerable: 0, weak: 0, poison: 0 },
    status: 'ongoing', log: [], feedback: emptyFeedback(0),
  };
  if (input.attributes.agility >= 3) battle.log.push('You act first: +1 energy this turn.');
  const [count, rng2] = rollDrawCount(battle);
  return drawCards({ ...battle, rng: rng2 }, count);
}

function emptyFeedback(seq: number): Feedback {
  return { seq, dealt: null, taken: null, blocked: null, healed: null, crit: false, effect: null };
}

export function foeIntent(battle: Pick<Battle, 'foe' | 'step' | 'enraged'>): Intent {
  const list = battle.enraged && battle.foe.enragedIntents ? battle.foe.enragedIntents : battle.foe.intents;
  return list[battle.step % list.length] ?? { kind: 'attack', value: 1 };
}

/** Per-hit damage the foe will deal with its current intent, after its Roar stacks. */
export function intentDamage(battle: Pick<Battle, 'foe' | 'step' | 'enraged'>): { value: number; hits: number } | null {
  const intent = foeIntent(battle);
  if (intent.kind !== 'attack') return null;
  return { value: foeHitValue(battle.foe, intent.value), hits: intent.hits ?? 1 };
}

/** Per-hit foe damage after Roar stacks and Weaken. */
export function foeHitValue(foe: Pick<FoeState, 'strength' | 'weak'>, value: number): number {
  const raw = value + foe.strength;
  return foe.weak > 0 ? Math.floor(raw * WEAK_MULTIPLIER) : raw;
}

export function canPlay(battle: Battle, uid: number): boolean {
  if (battle.status !== 'ongoing') return false;
  const instance = battle.hand.find((entry) => entry.uid === uid);
  return !!instance && CARDS[instance.id].cost <= battle.energy;
}

/** Damage preview for a card in hand, before crits. */
export function previewDamage(battle: Battle, id: CardId): number | null {
  const def = CARDS[id];
  const base = baseHit(def, battle);
  if (!base) return null;
  return hitAfterModifiers(base, def.element, battle, def.kind === 'attack' && battle.focused);
}

/** Per-hit damage from the card, attributes and battle effects (Battle Cry, Momentum, Body Slam). */
function baseHit(def: CardDef, battle: Battle): number {
  const attributes = battle.attributes;
  let base = 0;
  if (def.bodySlam) base = battle.block + luckBonus(attributes);
  else if (def.damage) base = cardHitDamage(def, attributes);
  else if (def.counter) base = def.counter + strengthBonus(attributes) + luckBonus(attributes);
  if (!base) return 0;
  if (def.momentum) base += def.momentum * battle.played;
  if (def.kind === 'attack') base += battle.might;
  return base;
}

function hitAfterModifiers(base: number, element: CardDefElement, battle: Battle, focused: boolean): number {
  let damage = base;
  if (focused) damage *= 2;
  const effect = effectiveness(element, battle.foe.type);
  if (effect === 'super') damage = Math.ceil(damage * EFFECTIVE_MULTIPLIER);
  if (effect === 'resisted') damage = Math.floor(damage * RESISTED_MULTIPLIER);
  if (battle.foe.vulnerable > 0) damage = Math.ceil(damage * VULNERABLE_MULTIPLIER);
  return Math.max(0, damage);
}
type CardDefElement = CardDef['element'];

function hitFoe(battle: Battle, base: number, def: CardDef, focused: boolean): { battle: Battle; dealt: number; crit: boolean } {
  const [roll, rng] = nextRoll(battle.rng);
  const forced = battle.critNext && def.kind === 'attack';
  const crit = forced || roll < critChance(battle.attributes) + (def.critBonus ?? 0);
  let damage = hitAfterModifiers(base, def.element, battle, focused);
  if (crit) damage = Math.ceil(damage * (def.critMultiplier ?? CRIT_MULTIPLIER));
  if (forced) battle = { ...battle, critNext: false };
  const absorbed = Math.min(battle.foe.block, damage);
  const dealt = damage - absorbed;
  return {
    battle: { ...battle, rng, foe: { ...battle.foe, block: battle.foe.block - absorbed, hp: Math.max(0, battle.foe.hp - dealt) } },
    dealt,
    crit,
  };
}

/** Play one card from hand. Invalid plays return the same state object. */
export function playCard(state: Battle, uid: number): Battle {
  if (!canPlay(state, uid)) return state;
  const instance = state.hand.find((entry) => entry.uid === uid) as CardInstance;
  const def = CARDS[instance.id];
  let battle: Battle = {
    ...state,
    energy: state.energy - def.cost,
    hand: state.hand.filter((entry) => entry.uid !== uid),
    log: state.log.slice(),
  };
  const feedback = emptyFeedback(state.feedback.seq + 1);
  const attributes = battle.attributes;
  const parts: string[] = [];
  const intent = foeIntent(battle);

  const counterLands = def.counter !== undefined && intent.kind === 'attack';
  if ((def.damage && def.damage > 0) || def.bodySlam || counterLands) {
    let base = baseHit(def, state);
    if (def.spread) {
      const [spreadRoll, afterSpread] = nextRoll(battle.rng);
      battle.rng = afterSpread;
      base += Math.floor(spreadRoll * (def.spread + 1));
    }
    const useFocus = def.kind === 'attack' && battle.focused;
    if (useFocus) battle.focused = false;
    let total = 0;
    let anyCrit = false;
    for (let hit = 0; hit < (def.hits ?? 1) && battle.foe.hp > 0; hit += 1) {
      const result = hitFoe(battle, base, def, useFocus);
      battle = result.battle;
      total += result.dealt;
      anyCrit = anyCrit || result.crit;
    }
    feedback.dealt = total;
    feedback.crit = anyCrit;
    feedback.effect = effectiveness(def.element, battle.foe.type);
    parts.push(`${def.name} deals ${total}${anyCrit ? ' — critical!' : ''}`);
    if (feedback.effect === 'super') parts.push("It's super effective!");
    if (feedback.effect === 'resisted') parts.push("It's not very effective…");
  }
  const block = cardBlock(def, attributes);
  if (block > 0) {
    battle.block += block;
    feedback.blocked = block;
    parts.push(`+${block} Block`);
  }
  const heal = cardHeal(def, attributes);
  if (heal > 0) {
    const healed = Math.min(battle.maxHp - battle.hp, heal);
    battle.hp += healed;
    feedback.healed = healed;
    parts.push(`healed ${healed}`);
  }
  if (def.vulnerable) {
    battle.foe = { ...battle.foe, vulnerable: battle.foe.vulnerable + def.vulnerable };
    parts.push(`${battle.foe.name} is exposed`);
  }
  const weak = cardWeak(def, attributes);
  if (weak > 0) {
    battle.foe = { ...battle.foe, weak: battle.foe.weak + weak };
    parts.push(`${battle.foe.name} is weakened`);
  }
  const poison = cardPoison(def, attributes);
  if (poison > 0) {
    battle.foe = { ...battle.foe, poison: battle.foe.poison + poison };
    parts.push(`poison ${battle.foe.poison}`);
  }
  if (def.might) {
    battle.might += def.might;
    parts.push(`attacks +${battle.might} this fight`);
  }
  if (def.dodgeNext) {
    battle.dodgeNext = true;
    parts.push('ready to dodge');
  }
  if (def.critNext) {
    battle.critNext = true;
    parts.push('next hit crits');
  }
  if (def.selfDamage) {
    battle.hp = Math.max(1, battle.hp - def.selfDamage);
    parts.push(`you lose ${def.selfDamage} HP`);
  }
  if (def.focus) {
    battle.focused = true;
    parts.push('next attack ×2');
  }
  if (def.energy) {
    battle.energy += def.energy;
    parts.push(`+${def.energy} energy`);
  }
  if (def.exhaust) battle.exhausted = [...battle.exhausted, instance];
  else battle.discard = [...battle.discard, instance];
  if (def.draw) battle = drawCards(battle, def.draw);
  battle.played += 1;

  battle.log.push(parts.length > 0 ? `${parts.join('. ')}.` : `${def.name}.`);
  battle.feedback = feedback;
  if (battle.foe.hp <= 0) {
    battle.status = 'won';
    battle.log.push(`${battle.foe.name} is defeated!`);
  }
  return battle;
}

/** End your turn: discard, the foe acts, then a new turn begins with fresh energy and cards. */
export function endTurn(state: Battle): Battle {
  if (state.status !== 'ongoing') return state;
  let battle: Battle = {
    ...state,
    discard: [...state.discard, ...state.hand],
    hand: [],
    log: state.log.slice(),
    foe: { ...state.foe, block: 0 },
  };
  const feedback = emptyFeedback(state.feedback.seq + 1);
  const intent = foeIntent(state);
  const name = battle.foe.name;

  if (battle.foe.poison > 0) {
    const tick = battle.foe.poison;
    const hp = Math.max(0, battle.foe.hp - tick);
    battle.foe = { ...battle.foe, hp, poison: tick - 1 };
    feedback.dealt = tick;
    battle.log.push(`Poison hits ${name} for ${tick}.`);
    if (hp <= 0) {
      return { ...battle, status: 'won', feedback, log: [...battle.log, `${name} is defeated!`] };
    }
  }

  if (intent.kind === 'attack') {
    const hits = intent.hits ?? 1;
    const perHit = foeHitValue(battle.foe, intent.value);
    let taken = 0;
    let blocked = 0;
    let dodged = 0;
    for (let hit = 0; hit < hits; hit += 1) {
      const [roll, rng] = nextRoll(battle.rng);
      const [dodgeRoll, afterDodge] = nextRoll(rng);
      battle.rng = afterDodge;
      if (battle.dodgeNext) {
        battle.dodgeNext = false;
        dodged += 1;
        continue;
      }
      if (dodgeRoll < dodgeChance(battle.attributes)) {
        dodged += 1;
        continue;
      }
      const damage = perHit + (roll < 0.25 ? 1 : 0);
      const absorbed = Math.min(battle.block, damage);
      battle.block -= absorbed;
      blocked += absorbed;
      taken += damage - absorbed;
    }
    battle.hp = Math.max(0, battle.hp - taken);
    feedback.taken = taken;
    feedback.blocked = blocked > 0 ? blocked : null;
    const label = intent.label ?? (hits > 1 ? `strikes ${hits} times` : 'attacks');
    const extras = [blocked > 0 ? `${blocked} blocked` : '', dodged > 0 ? `dodged ${dodged}` : ''].filter(Boolean).join(', ');
    battle.log.push(`${name} ${label}: ${taken} damage${extras ? ` (${extras})` : ''}.`);
  } else if (intent.kind === 'guard') {
    battle.foe = { ...battle.foe, block: intent.value };
    battle.log.push(`${name} braces behind ${intent.value} Block.`);
  } else {
    battle.foe = { ...battle.foe, strength: battle.foe.strength + intent.value };
    battle.log.push(`${name} roars! Its attacks grow by ${intent.value}.`);
  }

  if (battle.hp <= 0) {
    return { ...battle, status: 'lost', feedback, log: [...battle.log, 'You fall.'] };
  }

  battle.step += 1;
  if (!battle.enraged && battle.foe.enragedIntents && battle.foe.hp * 2 <= battle.foe.maxHp) {
    battle.enraged = true;
    battle.step = 0;
    battle.log.push(`${name} howls with fury. Its pattern changes!`);
  }
  battle.foe = { ...battle.foe, vulnerable: Math.max(0, battle.foe.vulnerable - 1), weak: Math.max(0, battle.foe.weak - 1) };
  battle = { ...battle, turn: battle.turn + 1, energy: energyForTurn(battle.attributes, battle.turn + 1), block: 0, played: 0, feedback };
  const [count, rng] = rollDrawCount(battle);
  return drawCards({ ...battle, rng }, count);
}

export function intentText(battle: Pick<Battle, 'foe' | 'step' | 'enraged'>): string {
  const intent = foeIntent(battle);
  if (intent.kind === 'attack') {
    const value = foeHitValue(battle.foe, intent.value);
    const hits = intent.hits ?? 1;
    const label = intent.label ?? 'Attack';
    return hits > 1 ? `${label} ${value}×${hits}` : `${label} ${value}`;
  }
  if (intent.kind === 'guard') return `Guard ${intent.value}`;
  return `Roar +${intent.value}`;
}
