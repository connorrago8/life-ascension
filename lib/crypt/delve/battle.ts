import {
  strengthBonus, luckBonus, EFFECTIVE_MULTIPLIER, RESISTED_MULTIPLIER, COMBO_AT, cardBlock, cardBleed, cardBurn, cardDef, cardHeal,
  cardHitDamage, cardThorns, cardWeak, comboBonus, effectiveness, type CardDef, type DeckCard, type MonsterType,
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
  | { kind: 'roar'; value: number }
  /** Telegraph: the foe winds up (gaining `value` Block). Its next move is the big hit. */
  | { kind: 'charge'; value: number }
  /** Debuff: you are Weakened for `value` turns (your attacks deal 25% less). */
  | { kind: 'hex'; value: number };

/** Passives from Rare+ gear. Shown on the gear tooltip. */
export type GearPassive = 'twin-strike' | 'start-block' | 'burn-plus' | 'start-thorns' | 'first-dodge' | 'keen-eye';
export const PASSIVE_TEXT: Record<GearPassive, string> = {
  'twin-strike': 'Your first attack each turn hits one extra time.',
  'start-block': 'Start every fight with 4 Block.',
  'burn-plus': 'Burn ticks +1.',
  'start-thorns': 'Start every fight with 3 Thorns.',
  'first-dodge': 'Dodge the first enemy hit of every fight.',
  'keen-eye': '+10% crit chance.',
};

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

export type CardInstance = { uid: number; id: DeckCard };

export type FoeState = Foe & {
  block: number; strength: number; vulnerable: number; weak: number;
  /** Burn (INT): ticks at the start of its turn, then fades by 1. */
  burn: number;
  /** Bleed (STR): ticks at the start of its turn and lasts the fight. */
  bleed: number;
};

/** A status or gear effect that just triggered, for a small floating number or toast. */
export type Proc = { kind: 'bleed' | 'burn' | 'thorns' | 'combo' | 'worn' | 'gear'; amount: number; text: string };

/**
 * Damage floor for long fights (END tune): from WORN_DOWN_TURN on, if your cards took less HP
 * than your steady pressure (END × WORN_DOWN_PER_END) this turn, the foe is worn down by the
 * difference as its turn starts. Hard hitters never see it; it keeps all-Block fights moving.
 */
export const WORN_DOWN_TURN = 2;
export const WORN_DOWN_PER_END = 1.75;
export function wornDownDamage(turn: number, endurance: number, dealtThisTurn: number): number {
  if (turn < WORN_DOWN_TURN) return 0;
  return Math.max(0, Math.floor(endurance * WORN_DOWN_PER_END) - Math.max(0, dealtThisTurn));
}

export type Feedback = {
  /** Increments every resolved card or enemy turn so the UI can replay its animation. */
  seq: number;
  dealt: number | null;
  taken: number | null;
  blocked: number | null;
  healed: number | null;
  crit: boolean;
  effect: 'super' | 'resisted' | 'normal' | null;
  /** Statuses and gear passives that triggered on this step. */
  procs: Proc[];
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
  /** Cards played this turn (Momentum, combo). */
  played: number;
  /** Thorns (END): the foe takes this much each time it hits you. Lasts the fight. */
  thorns: number;
  /** Entrench: keep your Block into the next turn. */
  retain: boolean;
  /** Haste: extra energy next turn. */
  haste: number;
  /** Hexed: your attacks deal 25% less for this many turns. */
  weak: number;
  /** Rare+ gear passives in effect. */
  passives: readonly GearPassive[];
  /** Twin strike already used this turn. */
  firstAttackDone: boolean;
  /** Foe HP when this turn began, for the long-fight damage floor. */
  turnStartHp: number;
  /** The ready dodge came from gear (Moth Ward), so it shows a gear toast when used. */
  gearDodge: boolean;
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
  rng: Rng; deck: readonly DeckCard[]; attributes: Attributes; hp: number; maxHp: number; foe: Foe;
  passives?: readonly GearPassive[];
}): Battle {
  const passives = input.passives ?? [];
  const cards = input.deck.map((id, uid) => ({ uid, id }));
  const [drawPile, rng] = shuffle(cards, input.rng);
  const battle: Battle = {
    rng, turn: 1, step: 0, enraged: false, attributes: input.attributes,
    hp: input.hp, maxHp: input.maxHp, block: 0, energy: energyForTurn(input.attributes, 1), focused: false,
    might: 0, dodgeNext: passives.includes('first-dodge'), critNext: false, played: 0,
    thorns: passives.includes('start-thorns') ? 3 : 0, retain: false, haste: 0, weak: 0, passives, firstAttackDone: false,
    gearDodge: passives.includes('first-dodge'), turnStartHp: input.foe.hp,
    drawPile, hand: [], discard: [], exhausted: [],
    foe: { ...input.foe, block: 0, strength: 0, vulnerable: 0, weak: 0, burn: 0, bleed: 0 },
    status: 'ongoing', log: [], feedback: emptyFeedback(0),
  };
  if (passives.includes('start-block')) {
    battle.block = 4;
    battle.feedback.procs.push({ kind: 'gear', amount: 4, text: 'Gear: start with 4 Block' });
  }
  if (passives.includes('start-thorns')) battle.feedback.procs.push({ kind: 'gear', amount: 3, text: 'Gear: Thorns 3' });
  if (passives.includes('first-dodge')) battle.feedback.procs.push({ kind: 'gear', amount: 0, text: 'Gear: first hit will miss' });
  if (input.attributes.agility >= 3) battle.log.push('You act first: +1 energy this turn.');
  const [count, rng2] = rollDrawCount(battle);
  return drawCards({ ...battle, rng: rng2 }, count);
}

function emptyFeedback(seq: number): Feedback {
  return { seq, dealt: null, taken: null, blocked: null, healed: null, crit: false, effect: null, procs: [] };
}

export function foeIntent(battle: Pick<Battle, 'foe' | 'step' | 'enraged'>, ahead = 0): Intent {
  const list = battle.enraged && battle.foe.enragedIntents ? battle.foe.enragedIntents : battle.foe.intents;
  return list[(battle.step + ahead) % list.length] ?? { kind: 'attack', value: 1 };
}

/** The move after the next one (so a wind-up shows what is coming). */
export function upcomingIntent(battle: Pick<Battle, 'foe' | 'step' | 'enraged'>): Intent {
  return foeIntent(battle, 1);
}

/**
 * Exactly what the foe's next move will do to you, after its Rage, Weaken and your Block.
 * Dodge (AGI) is a chance, so it is not counted here.
 */
export function incomingDamage(battle: Pick<Battle, 'foe' | 'step' | 'enraged' | 'block'>): {
  perHit: number; hits: number; total: number; afterBlock: number;
} | null {
  const hit = intentDamage(battle);
  if (!hit) return null;
  const total = hit.value * hit.hits;
  return { perHit: hit.value, hits: hit.hits, total, afterBlock: Math.max(0, total - battle.block) };
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
  return !!instance && cardDef(instance.id).cost <= battle.energy;
}

/** True when the next card you play is your combo card (the 3rd this turn). */
export function comboReady(battle: Pick<Battle, 'played'>): boolean {
  return battle.played === COMBO_AT - 1;
}

/** Damage preview (per hit) for a card in hand, before crits. */
export function previewDamage(battle: Battle, id: DeckCard): number | null {
  const def = cardDef(id);
  const base = baseHit(def, battle);
  if (!base) return null;
  return hitAfterModifiers(base, def.element, battle, def.kind === 'attack' && battle.focused);
}

/** Number of hits a card will land this turn (twin strike adds one to the first attack). */
export function previewHits(battle: Battle, id: DeckCard): number {
  const def = cardDef(id);
  return (def.hits ?? 1) + (twinReady(battle, def) ? 1 : 0);
}

function twinReady(battle: Battle, def: CardDef): boolean {
  return def.kind === 'attack' && !battle.firstAttackDone && battle.passives.includes('twin-strike');
}

/** Crit chance for a card, including gear. */
export function cardCritChance(battle: Battle, def: CardDef): number {
  return Math.min(1, critChance(battle.attributes) + (def.critBonus ?? 0) + (battle.passives.includes('keen-eye') ? 0.1 : 0));
}

/**
 * Per-hit parts of a card's damage before multipliers: the card itself (or Body Slam's Block),
 * Momentum, Might (Battle Cry) and the combo bonus. `baseHit` is exactly their sum, so the
 * synergy tags on a card always add up to the hit that lands. All zero when the card deals nothing.
 */
export type HitParts = { card: number; momentum: number; might: number; combo: number };

export function hitParts(def: CardDef, battle: Pick<Battle, 'attributes' | 'block' | 'played' | 'might'>): HitParts {
  const attributes = battle.attributes;
  let card = 0;
  if (def.bodySlam) card = battle.block + luckBonus(attributes) + (def.upgradedSlam ?? 0);
  else if (def.damage) card = cardHitDamage(def, attributes);
  else if (def.counter) card = def.counter + strengthBonus(attributes) + luckBonus(attributes);
  if (!card) return { card: 0, momentum: 0, might: 0, combo: 0 };
  return {
    card,
    momentum: def.momentum ? def.momentum * battle.played : 0,
    might: def.kind === 'attack' ? battle.might : 0,
    combo: comboReady(battle) ? comboBonus(attributes) : 0,
  };
}

/** Per-hit damage from the card, attributes and battle effects (Battle Cry, Momentum, Body Slam). */
function baseHit(def: CardDef, battle: Battle): number {
  const parts = hitParts(def, battle);
  return parts.card + parts.momentum + parts.might + parts.combo;
}

/** A short, display-only reason the number on a card changed. */
export type CardCue = { key: 'might' | 'momentum' | 'combo' | 'focus' | 'exposed' | 'hexed' | 'slam'; label: string; warn?: boolean };

/**
 * Synergy cues for a card in hand, built from `hitParts` and the same flags `hitAfterModifiers`
 * reads, so a tag never claims a bonus the hit will not get.
 */
export function cardCues(battle: Battle, id: DeckCard): CardCue[] {
  const def = cardDef(id);
  const parts = hitParts(def, battle);
  const cues: CardCue[] = [];
  const hits = parts.card > 0;
  if (def.bodySlam) {
    cues.push(hits ? { key: 'slam', label: `= Block ${battle.block}` } : { key: 'slam', label: 'No Block: 0', warn: true });
    if (!hits && def.kind === 'attack' && battle.focused) cues.push({ key: 'focus', label: 'Wastes Focus', warn: true });
  }
  if (parts.might > 0) cues.push({ key: 'might', label: `Might +${parts.might}` });
  if (parts.momentum > 0) cues.push({ key: 'momentum', label: `Momentum +${parts.momentum}` });
  if (parts.combo > 0) cues.push({ key: 'combo', label: `Combo +${parts.combo}` });
  else if (comboReady(battle) && !def.damage && !def.bodySlam && cardBlock(def, battle.attributes) > 0) {
    cues.push({ key: 'combo', label: `Combo +${comboBonus(battle.attributes)} Block` });
  }
  if (hits && def.kind === 'attack' && battle.focused) cues.push({ key: 'focus', label: 'Focus ×2' });
  if (hits && battle.foe.vulnerable > 0) cues.push({ key: 'exposed', label: 'Exposed ×1.5' });
  if (hits && battle.weak > 0) cues.push({ key: 'hexed', label: 'Hexed −25%' });
  return cues;
}

function hitAfterModifiers(base: number, element: CardDefElement, battle: Battle, focused: boolean): number {
  let damage = base;
  if (focused) damage *= 2;
  if (battle.weak > 0) damage = Math.floor(damage * WEAK_MULTIPLIER);
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
  const crit = forced || roll < cardCritChance(battle, def);
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
  const def = cardDef(instance.id);
  const combo = comboReady(state);
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
    const twin = twinReady(battle, def);
    const hits = (def.hits ?? 1) + (twin ? 1 : 0);
    if (twin) feedback.procs.push({ kind: 'gear', amount: 1, text: 'Gear: twin strike!' });
    if (combo) feedback.procs.push({ kind: 'combo', amount: comboBonus(attributes), text: `Combo +${comboBonus(attributes)}` });
    if (def.kind === 'attack') battle.firstAttackDone = true;
    let total = 0;
    let anyCrit = false;
    for (let hit = 0; hit < hits && battle.foe.hp > 0; hit += 1) {
      const result = hitFoe(battle, base, def, useFocus);
      battle = result.battle;
      total += result.dealt;
      anyCrit = anyCrit || result.crit;
    }
    feedback.dealt = total;
    feedback.crit = anyCrit;
    feedback.effect = effectiveness(def.element, battle.foe.type);
    parts.push(`${def.name} deals ${total}${anyCrit ? ' — critical!' : ''}${combo ? ' (combo!)' : ''}`);
    if (feedback.effect === 'super') parts.push("It's super effective!");
    if (feedback.effect === 'resisted') parts.push("It's not very effective…");
  }
  let block = cardBlock(def, attributes);
  if (block > 0 && combo && !def.damage && !def.bodySlam) {
    block += comboBonus(attributes);
    feedback.procs.push({ kind: 'combo', amount: comboBonus(attributes), text: `Combo +${comboBonus(attributes)} Block` });
  }
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
  const burn = cardBurn(def, attributes);
  if (burn > 0) {
    battle.foe = { ...battle.foe, burn: battle.foe.burn + burn };
    parts.push(`Burn ${battle.foe.burn}`);
  }
  const bleed = cardBleed(def, attributes);
  if (bleed > 0) {
    battle.foe = { ...battle.foe, bleed: battle.foe.bleed + bleed };
    parts.push(`Bleed ${battle.foe.bleed}`);
  }
  const thorns = cardThorns(def, attributes);
  if (thorns > 0) {
    battle.thorns += thorns;
    parts.push(`Thorns ${battle.thorns}`);
  }
  if (def.retain) {
    battle.retain = true;
    parts.push('Block kept next turn');
  }
  if (def.haste) {
    battle.haste += def.haste;
    parts.push(`+${battle.haste} energy next turn`);
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
  // Draw while the played card is still in play, then move it to discard/exhaust.
  // A card that draws can never reshuffle and redraw itself (no Haste/Insight loops).
  if (def.draw) battle = drawCards(battle, def.draw);
  if (def.exhaust) battle.exhausted = [...battle.exhausted, instance];
  else battle.discard = [...battle.discard, instance];
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
  // Your Hex wears off as your turn ends.
  battle.weak = Math.max(0, battle.weak - 1);

  const burnPlus = battle.foe.burn > 0 && battle.passives.includes('burn-plus');
  const burnTick = battle.foe.burn > 0 ? battle.foe.burn + (burnPlus ? 1 : 0) : 0;
  const worn = wornDownDamage(battle.turn, battle.attributes.endurance, battle.turnStartHp - battle.foe.hp);
  const tick = burnTick + battle.foe.bleed + worn;
  if (tick > 0) {
    const hp = Math.max(0, battle.foe.hp - tick);
    battle.foe = { ...battle.foe, hp, burn: Math.max(0, battle.foe.burn - 1) };
    feedback.dealt = tick;
    if (burnTick) feedback.procs.push({ kind: 'burn', amount: burnTick, text: `Burn −${burnTick}` });
    if (burnPlus) feedback.procs.push({ kind: 'gear', amount: 1, text: 'Gear: Burn +1' });
    if (battle.foe.bleed) feedback.procs.push({ kind: 'bleed', amount: battle.foe.bleed, text: `Bleed −${battle.foe.bleed}` });
    if (worn) feedback.procs.push({ kind: 'worn', amount: worn, text: `Worn down −${worn}` });
    const what = [burnTick ? `Burn ${burnTick}` : '', battle.foe.bleed ? `Bleed ${battle.foe.bleed}` : '', worn ? `Worn down ${worn}` : '']
      .filter(Boolean).join(' + ');
    battle.log.push(`${what} hits ${name} for ${tick}.`);
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
    let thorned = 0;
    for (let hit = 0; hit < hits; hit += 1) {
      const [dodgeRoll, afterDodge] = nextRoll(battle.rng);
      battle.rng = afterDodge;
      if (battle.dodgeNext) {
        battle.dodgeNext = false;
        if (battle.gearDodge) feedback.procs.push({ kind: 'gear', amount: 0, text: 'Gear: dodged!' });
        battle.gearDodge = false;
        dodged += 1;
        continue;
      }
      if (dodgeRoll < dodgeChance(battle.attributes)) {
        dodged += 1;
        continue;
      }
      if (battle.thorns > 0) thorned += battle.thorns;
      const damage = perHit;
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
    if (thorned > 0) {
      const hp = Math.max(0, battle.foe.hp - thorned);
      battle.foe = { ...battle.foe, hp };
      battle.log.push(`Thorns hit ${name} for ${thorned}.`);
      feedback.procs.push({ kind: 'thorns', amount: thorned, text: `Thorns −${thorned}` });
      if (hp <= 0 && battle.hp > 0) {
        return { ...battle, status: 'won', feedback, log: [...battle.log, `${name} is defeated!`] };
      }
    }
  } else if (intent.kind === 'charge') {
    if (intent.value > 0) battle.foe = { ...battle.foe, block: intent.value };
    const next = upcomingIntent(state);
    battle.log.push(`${name} winds up${intent.value > 0 ? ` behind ${intent.value} Block` : ''}. ${next.kind === 'attack' ? `${intentLabel(next)} is coming!` : ''}`.trim());
  } else if (intent.kind === 'hex') {
    battle.weak += intent.value;
    battle.log.push(`${name} hexes you: your attacks deal 25% less for ${intent.value} turn${intent.value > 1 ? 's' : ''}.`);
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
  battle = {
    ...battle, turn: battle.turn + 1, energy: energyForTurn(battle.attributes, battle.turn + 1) + battle.haste, haste: 0,
    block: battle.retain ? battle.block : 0, retain: false, played: 0, firstAttackDone: false, feedback,
    turnStartHp: battle.foe.hp,
  };
  const [count, rng] = rollDrawCount(battle);
  return drawCards({ ...battle, rng }, count);
}

function intentLabel(intent: Intent): string {
  return intent.kind === 'attack' ? intent.label ?? 'Attack' : '';
}

export const INTENT_ICON: Record<Intent['kind'], string> = { attack: '⚔', guard: '🛡', roar: '💪', charge: '⚡', hex: '☠' };

/** Short text for a foe move with exact numbers (after Rage and Weaken). */
export function describeIntent(intent: Intent, foe: Pick<FoeState, 'strength' | 'weak'>): string {
  if (intent.kind === 'attack') {
    const value = foeHitValue(foe, intent.value);
    const hits = intent.hits ?? 1;
    const label = intentLabel(intent);
    return hits > 1 ? `${label} ${value}×${hits}` : `${label} ${value}`;
  }
  if (intent.kind === 'guard') return `Guard ${intent.value}`;
  if (intent.kind === 'charge') return `Winding up${intent.value > 0 ? ` (Block ${intent.value})` : ''}`;
  if (intent.kind === 'hex') return `Hex: Weaken you ${intent.value}`;
  return `Roar +${intent.value}`;
}

export function intentText(battle: Pick<Battle, 'foe' | 'step' | 'enraged'>, ahead = 0): string {
  return describeIntent(foeIntent(battle, ahead), battle.foe);
}

/** A telegraphed big hit: the move after a wind-up. */
export function bigHitComing(battle: Pick<Battle, 'foe' | 'step' | 'enraged'>): boolean {
  return foeIntent(battle).kind === 'charge' && upcomingIntent(battle).kind === 'attack';
}
