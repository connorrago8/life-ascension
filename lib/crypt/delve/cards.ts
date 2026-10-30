import type { Attributes } from './stats.ts';

/**
 * Card moves. Every turn you get 3 energy and draw 5 cards (AGI adds energy and draw chances).
 * Elements work like monster types (Pokémon style): some hit "super effective".
 *   STR powers physical attacks · AGI cheap combo cards · INT spells, skills and statuses
 *   END Block and HP · LCK crits and gear.
 */
export type Element = 'physical' | 'fire' | 'frost' | 'holy' | 'arcane';
export type MonsterType = 'bone' | 'shadow' | 'flame' | 'stone' | 'spirit' | 'rot';
export type Archetype = 'basic' | 'bruiser' | 'combo' | 'caster' | 'tank' | 'luck';

export const MONSTER_TYPES: readonly MonsterType[] = ['bone', 'shadow', 'flame', 'stone', 'spirit', 'rot'];
export const TYPE_LABEL: Record<MonsterType, string> = {
  bone: 'Bone', shadow: 'Shadow', flame: 'Flame', stone: 'Stone', spirit: 'Spirit', rot: 'Rot',
};
export const ELEMENT_LABEL: Record<Element, string> = {
  physical: 'Physical', fire: 'Fire', frost: 'Frost', holy: 'Holy', arcane: 'Arcane',
};

/** Type chart: which monster types each element hits super effectively (×1.5) or is resisted by (×0.75). */
export const SUPER_EFFECTIVE: Record<Element, readonly MonsterType[]> = {
  physical: ['bone'],
  fire: ['rot'],
  frost: ['flame'],
  holy: ['shadow'],
  arcane: ['spirit', 'stone'],
};
export const RESISTED: Record<Element, readonly MonsterType[]> = {
  physical: ['stone', 'spirit'],
  fire: ['flame'],
  frost: ['stone'],
  holy: [],
  arcane: ['shadow'],
};
export const EFFECTIVE_MULTIPLIER = 1.5;
export const RESISTED_MULTIPLIER = 0.75;

/** Elements that hit a monster type hard, for the "Weak to" hint. */
export function weaknessesOf(type: MonsterType): Element[] {
  return (Object.keys(SUPER_EFFECTIVE) as Element[]).filter((element) => SUPER_EFFECTIVE[element].includes(type));
}
export function resistancesOf(type: MonsterType): Element[] {
  return (Object.keys(RESISTED) as Element[]).filter((element) => RESISTED[element].includes(type));
}

export type CardId =
  // basics
  | 'strike' | 'guard' | 'bash' | 'focus' | 'spark' | 'expose'
  // bruiser (STR)
  | 'heavy-blow' | 'reckless-swing' | 'battle-cry' | 'cleaver' | 'rend'
  // combo (AGI)
  | 'quick-jab' | 'flurry' | 'adrenaline' | 'sidestep' | 'momentum' | 'riposte' | 'haste'
  // caster (INT)
  | 'arcane-bolt' | 'smite' | 'ember' | 'frost-shard' | 'kindle' | 'hex' | 'insight'
  // tank (END)
  | 'shield-bash' | 'bulwark' | 'iron-skin' | 'body-slam' | 'second-wind' | 'spiked-guard' | 'entrench'
  // crit / loot (LCK)
  | 'lucky-strike' | 'loaded-dice' | 'gamble' | 'jackpot';

export type CardDef = {
  id: CardId;
  name: string;
  cost: number;
  kind: 'attack' | 'skill';
  archetype: Archetype;
  element?: Element;
  /** Base damage per hit before attributes. */
  damage?: number;
  hits?: number;
  /** Gamble: adds 0..spread extra damage (rolled). */
  spread?: number;
  /** Momentum: +N damage for each other card played this turn. */
  momentum?: number;
  /** Body Slam: deals damage equal to your current Block. */
  bodySlam?: boolean;
  /** Body Slam+: extra flat damage. */
  upgradedSlam?: number;
  block?: number;
  heal?: number;
  draw?: number;
  energy?: number;
  /** Foe takes +50% damage for N turns. */
  vulnerable?: number;
  /** Foe deals 25% less damage for N turns. INT 9+ adds a turn. */
  weak?: number;
  /** Burn stacks (+1 per 3 INT). Ticks at the start of the foe's turn, then fades by 1. */
  burn?: number;
  /** Bleed stacks (+1 per 5 STR). Ticks at the start of the foe's turn and lasts the fight. */
  bleed?: number;
  /** Thorns: the foe takes this much each time it hits you (+1 per 5 END). Lasts the fight. */
  thorns?: number;
  /** Entrench: your Block is kept into your next turn. */
  retain?: boolean;
  /** Haste: +N energy next turn. */
  haste?: number;
  /** Battle Cry: +N damage to every attack hit for the rest of the fight. */
  might?: number;
  /** Sidestep: dodge the next enemy hit. */
  dodgeNext?: boolean;
  /** Loaded Dice: your next attack hit is a guaranteed crit. */
  critNext?: boolean;
  /** Extra crit chance for this card only. */
  critBonus?: number;
  /** Crit multiplier for this card (default ×2). */
  critMultiplier?: number;
  /** HP you lose when you play it. */
  selfDamage?: number;
  /** Riposte: extra damage only if the foe is about to attack. */
  counter?: number;
  focus?: boolean;
  exhaust?: boolean;
  text: string;
};

function card(def: CardDef): CardDef {
  return def;
}

/** STR adds 2 damage for every 3 points to each single-hit physical card. */
export function strengthBonus(attributes: Attributes): number {
  return Math.floor((attributes.strength * 4) / 5);
}

/** INT adds 2 damage for every 3 points to spells (any non-physical element). */
export function spellBonus(attributes: Attributes): number {
  return Math.floor((attributes.intelligence * 3) / 5);
}

/** LCK: lucky blows add 1 damage per 4 points to every attack hit, any element. */
export function luckBonus(attributes: Attributes): number {
  return Math.floor(attributes.luck / 4);
}

export function isSpell(def: CardDef): boolean {
  return !!def.element && def.element !== 'physical';
}

/** Damage per hit from the card and your attributes, before battle effects, type, focus, expose and crits. */
export function cardHitDamage(def: CardDef, attributes: Attributes): number {
  if (!def.damage) return 0;
  let base = def.damage;
  if (isSpell(def)) base += spellBonus(attributes);
  else if (def.hits && def.hits > 1) base += Math.floor(attributes.strength / 3);
  else base += strengthBonus(attributes);
  return base + luckBonus(attributes);
}

/** END adds 1 Block per 3 points; skills also get 1 per 4 INT. */
export function cardBlock(def: CardDef, attributes: Attributes): number {
  if (!def.block) return 0;
  const skill = def.kind === 'skill' ? Math.floor(attributes.intelligence / 4) : 0;
  return def.block + Math.floor(attributes.endurance / 3) + skill;
}

/** Healing grows with INT and END (1 per 2 points of each). */
export function cardHeal(def: CardDef, attributes: Attributes): number {
  return def.heal ? def.heal + Math.floor(attributes.intelligence / 2) + Math.floor(attributes.endurance / 2) : 0;
}

/** INT makes Burn stronger: +1 per 3 INT. */
export function cardBurn(def: CardDef, attributes: Attributes): number {
  return def.burn ? def.burn + Math.floor(attributes.intelligence / 3) : 0;
}

/** STR makes Bleed stronger: +1 per 5 STR. */
export function cardBleed(def: CardDef, attributes: Attributes): number {
  return def.bleed ? def.bleed + Math.floor(attributes.strength / 5) : 0;
}

/** END makes Thorns stronger: +1 per 5 END. */
export function cardThorns(def: CardDef, attributes: Attributes): number {
  return def.thorns ? def.thorns + Math.floor(attributes.endurance / 5) : 0;
}

/** AGI combo: the 3rd card you play each turn gets +2 (+1 per 3 AGI) damage or Block. */
export const COMBO_AT = 3;
export function comboBonus(attributes: Attributes): number {
  return 2 + Math.floor(Math.max(0, attributes.agility) / 3);
}

/** INT 9+ makes Weak last one more turn. */
export function cardWeak(def: CardDef, attributes: Attributes): number {
  return def.weak ? def.weak + (attributes.intelligence >= 9 ? 1 : 0) : 0;
}

export function effectiveness(element: Element | undefined, type: MonsterType): 'super' | 'resisted' | 'normal' {
  if (!element) return 'normal';
  if (SUPER_EFFECTIVE[element].includes(type)) return 'super';
  if (RESISTED[element].includes(type)) return 'resisted';
  return 'normal';
}

export const CARDS: Record<CardId, CardDef> = {
  // Basics
  strike: card({ id: 'strike', name: 'Strike', cost: 1, kind: 'attack', archetype: 'basic', element: 'physical', damage: 6, text: 'Deal 6 (+STR).' }),
  guard: card({ id: 'guard', name: 'Guard', cost: 1, kind: 'skill', archetype: 'basic', block: 5, text: 'Gain 5 Block (+END, +INT).' }),
  bash: card({ id: 'bash', name: 'Bash', cost: 2, kind: 'attack', archetype: 'bruiser', element: 'physical', damage: 11, vulnerable: 1, text: 'Deal 11 (+STR). Expose 1 turn.' }),
  focus: card({ id: 'focus', name: 'Focus', cost: 0, kind: 'skill', archetype: 'basic', focus: true, exhaust: true, text: 'Your next attack deals double. Once per fight.' }),
  spark: card({ id: 'spark', name: 'Spark', cost: 1, kind: 'attack', archetype: 'caster', element: 'arcane', damage: 5, text: 'Deal 5 arcane (+INT).' }),
  expose: card({ id: 'expose', name: 'Expose', cost: 1, kind: 'skill', archetype: 'basic', vulnerable: 2, draw: 1, text: 'Expose 2 turns (+50% damage taken). Draw 1.' }),
  // Bruiser: big STR hits
  'heavy-blow': card({ id: 'heavy-blow', name: 'Heavy Blow', cost: 2, kind: 'attack', archetype: 'bruiser', element: 'physical', damage: 15, text: 'Deal 15 (+STR).' }),
  'reckless-swing': card({ id: 'reckless-swing', name: 'Reckless Swing', cost: 1, kind: 'attack', archetype: 'bruiser', element: 'physical', damage: 11, selfDamage: 3, text: 'Deal 11 (+STR). Lose 3 HP.' }),
  'battle-cry': card({ id: 'battle-cry', name: 'Battle Cry', cost: 1, kind: 'skill', archetype: 'bruiser', might: 2, exhaust: true, text: 'Every attack hit deals +2 for the rest of this fight.' }),
  cleaver: card({ id: 'cleaver', name: 'Cleaver', cost: 1, kind: 'attack', archetype: 'bruiser', element: 'physical', damage: 7, bleed: 1, text: 'Deal 7 (+STR). Bleed 1 (+STR).' }),
  rend: card({ id: 'rend', name: 'Rend', cost: 1, kind: 'attack', archetype: 'bruiser', element: 'physical', damage: 4, bleed: 3, text: 'Deal 4 (+STR). Bleed 3 (+1 per 5 STR): loses HP every turn.' }),
  // Combo: cheap AGI chains
  'quick-jab': card({ id: 'quick-jab', name: 'Quick Jab', cost: 0, kind: 'attack', archetype: 'combo', element: 'physical', damage: 3, text: 'Free. Deal 3 (+STR).' }),
  flurry: card({ id: 'flurry', name: 'Flurry', cost: 1, kind: 'attack', archetype: 'combo', element: 'physical', damage: 3, hits: 3, text: 'Deal 3 (+STR/3) three times. Great against Block.' }),
  adrenaline: card({ id: 'adrenaline', name: 'Adrenaline', cost: 0, kind: 'skill', archetype: 'combo', energy: 1, draw: 1, exhaust: true, text: 'Gain 1 energy. Draw 1. Once per fight.' }),
  sidestep: card({ id: 'sidestep', name: 'Sidestep', cost: 1, kind: 'skill', archetype: 'combo', block: 3, dodgeNext: true, draw: 1, text: 'Dodge the next hit. Gain 3 Block. Draw 1.' }),
  momentum: card({ id: 'momentum', name: 'Momentum', cost: 1, kind: 'attack', archetype: 'combo', element: 'physical', damage: 4, momentum: 3, text: 'Deal 4 (+STR), +3 for each card played before it this turn.' }),
  haste: card({ id: 'haste', name: 'Haste', cost: 0, kind: 'skill', archetype: 'combo', haste: 1, draw: 1, text: '+1 energy next turn. Draw 1.' }),
  riposte: card({ id: 'riposte', name: 'Riposte', cost: 1, kind: 'skill', archetype: 'combo', block: 4, counter: 7, element: 'physical', text: 'Gain 4 Block. If it is about to attack, deal 7 (+STR).' }),
  // Caster: INT spells and statuses
  'arcane-bolt': card({ id: 'arcane-bolt', name: 'Arcane Bolt', cost: 1, kind: 'attack', archetype: 'caster', element: 'arcane', damage: 7, text: 'Deal 7 arcane (+INT). Super effective vs Spirit and Stone.' }),
  smite: card({ id: 'smite', name: 'Smite', cost: 1, kind: 'attack', archetype: 'caster', element: 'holy', damage: 7, text: 'Deal 7 holy (+INT). Super effective vs Shadow.' }),
  ember: card({ id: 'ember', name: 'Ember', cost: 1, kind: 'attack', archetype: 'caster', element: 'fire', damage: 5, burn: 2, text: 'Deal 5 fire (+INT). Burn 2 (+INT). Super effective vs Rot.' }),
  'frost-shard': card({ id: 'frost-shard', name: 'Frost Shard', cost: 1, kind: 'attack', archetype: 'caster', element: 'frost', damage: 6, weak: 1, text: 'Deal 6 frost (+INT). Weaken 1 turn. Super effective vs Flame.' }),
  kindle: card({ id: 'kindle', name: 'Kindle', cost: 1, kind: 'skill', archetype: 'caster', burn: 4, text: 'Burn 4 (+1 per 3 INT). Burn hits each turn, then fades by 1.' }),
  hex: card({ id: 'hex', name: 'Hex', cost: 1, kind: 'skill', archetype: 'caster', weak: 2, vulnerable: 1, text: 'Weaken 2 turns (−25% damage) and Expose 1 turn. INT 9+: Weaken lasts longer.' }),
  insight: card({ id: 'insight', name: 'Insight', cost: 0, kind: 'skill', archetype: 'caster', draw: 2, text: 'Draw 2 cards.' }),
  // Tank: END Block and HP
  'shield-bash': card({ id: 'shield-bash', name: 'Shield Bash', cost: 1, kind: 'attack', archetype: 'tank', element: 'physical', damage: 4, block: 4, text: 'Deal 4 (+STR) and gain 4 Block (+END).' }),
  bulwark: card({ id: 'bulwark', name: 'Bulwark', cost: 2, kind: 'skill', archetype: 'tank', block: 12, text: 'Gain 12 Block (+END, +INT).' }),
  'iron-skin': card({ id: 'iron-skin', name: 'Iron Skin', cost: 1, kind: 'skill', archetype: 'tank', block: 7, text: 'Gain 7 Block (+END, +INT).' }),
  'body-slam': card({ id: 'body-slam', name: 'Body Slam', cost: 1, kind: 'attack', archetype: 'tank', element: 'physical', bodySlam: true, text: 'Deal damage equal to your Block.' }),
  'spiked-guard': card({ id: 'spiked-guard', name: 'Spiked Guard', cost: 1, kind: 'skill', archetype: 'tank', block: 5, thorns: 2, text: 'Gain 5 Block. Thorns 2 (+1 per 5 END): attackers take damage.' }),
  entrench: card({ id: 'entrench', name: 'Entrench', cost: 1, kind: 'skill', archetype: 'tank', block: 4, retain: true, text: 'Gain 4 Block. Keep your Block into next turn.' }),
  'second-wind': card({ id: 'second-wind', name: 'Second Wind', cost: 1, kind: 'skill', archetype: 'tank', heal: 5, exhaust: true, text: 'Heal 5 (+INT, +END). Once per fight.' }),
  // Luck: crits and swings
  'lucky-strike': card({ id: 'lucky-strike', name: 'Lucky Strike', cost: 1, kind: 'attack', archetype: 'luck', element: 'physical', damage: 5, critBonus: 0.3, text: 'Deal 5 (+STR). +30% crit chance.' }),
  'loaded-dice': card({ id: 'loaded-dice', name: 'Loaded Dice', cost: 0, kind: 'skill', archetype: 'luck', critNext: true, draw: 1, text: 'Your next attack hit crits. Draw 1.' }),
  gamble: card({ id: 'gamble', name: 'Gamble', cost: 1, kind: 'attack', archetype: 'luck', element: 'physical', damage: 2, spread: 12, text: 'Deal 2–14 (+STR). Luck of the draw.' }),
  jackpot: card({ id: 'jackpot', name: 'Jackpot', cost: 2, kind: 'attack', archetype: 'luck', element: 'physical', damage: 8, critMultiplier: 3, text: 'Deal 8 (+STR). Crits deal ×3.' }),
};

export const CARD_IDS: readonly CardId[] = Object.keys(CARDS) as CardId[];

export const STARTER_DECK: readonly CardId[] = [
  'strike', 'strike', 'strike', 'spark', 'guard', 'guard', 'guard', 'guard', 'bash', 'focus',
];

/** Cards that can be offered as fight rewards (everything except the starter basics). */
export const REWARD_POOL: readonly CardId[] = CARD_IDS.filter((id) => !['strike', 'guard', 'spark', 'focus'].includes(id));

export const MAX_DECK_SIZE = 26;

/* ---------- Upgrades (Smith at treasure / mystery rooms) ---------- */

/** A card in your deck: a card id, or its upgraded version with a "+" suffix. */
export type DeckCard = CardId | `${CardId}+`;

export function isUpgraded(key: DeckCard): boolean {
  return key.endsWith('+');
}

export function baseCardId(key: DeckCard): CardId {
  return (key.endsWith('+') ? key.slice(0, -1) : key) as CardId;
}

export function upgradedKey(key: DeckCard): DeckCard {
  return isUpgraded(key) ? key : (`${key}+` as DeckCard);
}

/** What an upgrade changes, in one short line. */
export function upgradeSummary(def: CardDef): string {
  const parts: string[] = [];
  if (def.damage) parts.push(def.hits && def.hits > 1 ? '+1 damage per hit' : '+3 damage');
  if (def.block) parts.push('+3 Block');
  if (def.burn) parts.push('+2 Burn');
  if (def.bleed) parts.push('+1 Bleed');
  if (def.thorns) parts.push('+1 Thorns');
  if (def.heal) parts.push('+3 heal');
  if (def.might) parts.push('+1 attack bonus');
  if (def.vulnerable && !def.damage) parts.push('+1 Expose');
  if (def.weak) parts.push('+1 Weaken');
  if (def.bodySlam || def.counter) parts.push('+4 damage');
  if (def.spread) parts.push('+4 max damage');
  if (parts.filter(Boolean).length === 0) parts.push(def.cost > 0 ? 'costs 1 less' : 'draw 1 more');
  return parts.filter(Boolean).join(', ');
}

const upgradeCache = new Map<CardId, CardDef>();

/** The upgraded version of a card: bigger numbers, or cheaper/extra draw for utility cards. */
export function upgradeDef(def: CardDef): CardDef {
  const cached = upgradeCache.get(def.id);
  if (cached) return cached;
  const next: CardDef = { ...def, name: `${def.name}+` };
  let changed = false;
  if (def.damage) { next.damage = def.damage + (def.hits && def.hits > 1 ? 1 : 3); changed = true; }
  if (def.block) { next.block = def.block + 3; changed = true; }
  if (def.burn) { next.burn = def.burn + 2; changed = true; }
  if (def.bleed) { next.bleed = def.bleed + 1; changed = true; }
  if (def.thorns) { next.thorns = def.thorns + 1; changed = true; }
  if (def.heal) { next.heal = def.heal + 3; changed = true; }
  if (def.might) { next.might = def.might + 1; changed = true; }
  if (def.vulnerable && !def.damage) { next.vulnerable = def.vulnerable + 1; changed = true; }
  if (def.weak) { next.weak = def.weak + 1; changed = true; }
  if (def.counter) { next.counter = def.counter + 4; changed = true; }
  if (def.spread) { next.spread = def.spread + 4; changed = true; }
  if (def.bodySlam) { next.upgradedSlam = 4; changed = true; }
  if (!changed) {
    if (def.cost > 0) next.cost = def.cost - 1;
    else next.draw = (def.draw ?? 0) + 1;
  }
  next.text = `${def.text} Upgraded: ${upgradeSummary(def)}.`;
  upgradeCache.set(def.id, next);
  return next;
}

/** Card definition for a deck entry (handles "+" upgrades). */
export function cardDef(key: DeckCard): CardDef {
  const def = CARDS[baseCardId(key)];
  return isUpgraded(key) ? upgradeDef(def) : def;
}
