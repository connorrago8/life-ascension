import { foeIntent, incomingDamage, type Battle, type Intent } from './battle.ts';
import type { Archetype, CardDef, DeckCard } from './cards.ts';

/**
 * Card and intent art: small inline SVG icons and frame classes. Display only:
 * nothing here changes what a card or an enemy does.
 */
export type IconKey =
  | 'sword' | 'blades' | 'mace' | 'shield' | 'flame' | 'snow' | 'sun' | 'star' | 'drop' | 'bolt' | 'eye'
  | 'clover' | 'dice' | 'heart' | 'cards' | 'skull' | 'target' | 'rise' | 'spikes' | 'hourglass';

/** 16×16 icons. `stroke` icons are drawn as 1.6px lines, the rest are filled (even-odd). */
export const ICONS: Record<IconKey, { d: string; stroke?: boolean }> = {
  sword: { d: 'M14.6 1.4l-.5 3.1-7.3 7.3-2.6-2.6 7.3-7.3z M2.4 8.5l1-1 5.1 5.1-1 1z M4 11l1 1-2.7 2.7a.7.7 0 0 1-1-1z' },
  blades: { d: 'M3 13L13 3 M1 9.5L7.5 3 M8.5 15L15 8.5', stroke: true },
  mace: { d: 'M10.5 1l4.5 4.5-3 3L7.5 4z M7.2 7.4l1.4 1.4L2.8 14.6 1.4 13.2z' },
  shield: { d: 'M8 1l6 2.2V7c0 3.9-2.5 6.5-6 8-3.5-1.5-6-4.1-6-8V3.2z' },
  flame: { d: 'M8 15c-2.8 0-4.5-2-4.5-4.6 0-2.4 1.6-3.6 2.4-5.4.9 1 1 2.2 1 3 .9-1.3 1.6-3.6.8-7 2.9 1.6 4.8 4.6 4.8 8.2 0 3.6-1.8 5.8-4.5 5.8z' },
  snow: { d: 'M8 1v14 M2 4.5l12 7 M2 11.5l12-7 M6.3 2.2L8 3.6l1.7-1.4 M6.3 13.8L8 12.4l1.7 1.4', stroke: true },
  sun: { d: 'M8 5.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 1 0 0-5.6 M8 1v2 M8 13v2 M1 8h2 M13 8h2 M3 3l1.4 1.4 M11.6 11.6L13 13 M3 13l1.4-1.4 M11.6 4.4L13 3', stroke: true },
  star: { d: 'M8 1l1.8 4.5 4.7.4-3.6 3.1 1.1 4.8L8 11.3 3.9 13.8 5 9 1.5 5.9l4.7-.4z' },
  drop: { d: 'M8 1C6.2 4.6 3.5 7.3 3.5 10.5a4.5 4.5 0 0 0 9 0C12.5 7.3 9.8 4.6 8 1z' },
  bolt: { d: 'M9.5 1L3 9.2h4.2L6.2 15l6.6-8.4H8.6z' },
  eye: { d: 'M1 8s2.6-4.8 7-4.8S15 8 15 8s-2.6 4.8-7 4.8S1 8 1 8z M8 6a2 2 0 1 0 0 4 2 2 0 1 0 0-4', stroke: true },
  clover: { d: 'M5.2 2.4a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 1 0 0-5.2 M10.8 2.4a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 1 0 0-5.2 M5.2 8a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 1 0 0-5.2 M10.8 8a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 1 0 0-5.2' },
  dice: { d: 'M3 2h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z M5 4a1.1 1.1 0 1 0 0 2.2A1.1 1.1 0 1 0 5 4z M8 6.9a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 1 0 0-2.2z M11 9.8a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 1 0 0-2.2z' },
  heart: { d: 'M8 14.2S1.5 10.3 1.5 5.6A3.3 3.3 0 0 1 8 4.2a3.3 3.3 0 0 1 6.5 1.4c0 4.7-6.5 8.6-6.5 8.6z' },
  cards: { d: 'M2.5 4.5h7v10h-7z M6 1.5h7.5v10', stroke: true },
  skull: { d: 'M8 1.2a6 6 0 0 0-6 6c0 2 .9 3.3 2 4.1V14h8v-2.7c1.1-.8 2-2.1 2-4.1a6 6 0 0 0-6-6z M5.6 6.6a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 1 0 0-2.8z M10.4 6.6a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 1 0 0-2.8z' },
  target: { d: 'M8 2a6 6 0 1 0 0 12A6 6 0 1 0 8 2 M8 5a3 3 0 1 0 0 6 3 3 0 1 0 0-6 M8 7.4v1.2', stroke: true },
  rise: { d: 'M3 8.5L8 3.5l5 5 M3 13.5l5-5 5 5', stroke: true },
  spikes: { d: 'M1 15l2.6-7.5L6 15l2-11 2 11 2.4-7.5L15 15z' },
  hourglass: { d: 'M3 1h10v2.2c0 2.4-2.4 3.9-3.5 4.8 1.1.9 3.5 2.4 3.5 4.8V15H3v-2.2c0-2.4 2.4-3.9 3.5-4.8C5.4 7.1 3 5.6 3 3.2z' },
};

/** The small art for a card, picked from what it does. */
export function cardIcon(def: CardDef): IconKey {
  if (def.element === 'fire' || def.burn) return 'flame';
  if (def.element === 'frost') return 'snow';
  if (def.element === 'holy') return 'sun';
  if (def.element === 'arcane') return 'star';
  if (def.heal) return 'heart';
  if (def.focus) return 'eye';
  if (def.critNext || def.spread) return 'dice';
  if (def.critBonus || def.critMultiplier) return 'clover';
  if (def.bleed) return 'drop';
  if (def.thorns) return 'spikes';
  if (def.energy || def.haste) return 'bolt';
  if (def.might) return 'rise';
  if (def.kind === 'skill' && def.weak) return 'skull';
  if (def.kind === 'skill' && def.vulnerable) return 'target';
  if (def.bodySlam || def.block) return def.kind === 'attack' && !def.bodySlam ? 'sword' : 'shield';
  if (def.hits && def.hits > 1) return 'blades';
  if (def.kind === 'skill') return def.draw ? 'cards' : 'shield';
  if (def.cost >= 2) return 'mace';
  return 'sword';
}

export const GROUP_LABEL: Record<Archetype, string> = {
  basic: 'Basic', bruiser: 'Bruiser', combo: 'Combo', caster: 'Caster', tank: 'Tank', luck: 'Luck',
};

/** Frame classes for a card: its group (archetype), type (attack/skill), element and upgrade. */
export function cardFrameClass(def: CardDef, upgraded = false): string {
  return [
    'delve-card', 'has-frame', `grp-${def.archetype}`, `kind-${def.kind}`,
    def.element ? `el-${def.element}` : '', upgraded ? 'upgraded' : '',
  ].filter(Boolean).join(' ');
}

/* ---------- Enemy intents ---------- */

export type IntentType = 'attack' | 'block' | 'buff' | 'debuff' | 'windup';
export const INTENT_TYPE: Record<Intent['kind'], IntentType> = {
  attack: 'attack', guard: 'block', roar: 'buff', hex: 'debuff', charge: 'windup',
};
export const INTENT_TYPE_LABEL: Record<IntentType, string> = {
  attack: 'Attack', block: 'Block', buff: 'Buff', debuff: 'Debuff', windup: 'Wind-up',
};
export const INTENT_TYPE_ICON: Record<IntentType, IconKey> = {
  attack: 'sword', block: 'shield', buff: 'rise', debuff: 'skull', windup: 'hourglass',
};

/** The icon badge for the foe's next move, with its main number (damage after Rage and Weaken). */
export function intentBadge(battle: Pick<Battle, 'foe' | 'step' | 'enraged' | 'block'>): {
  type: IntentType; label: string; icon: IconKey; value: string | null;
} {
  const intent = foeIntent(battle);
  const type = INTENT_TYPE[intent.kind];
  let value: string | null = null;
  if (intent.kind === 'attack') {
    const incoming = incomingDamage(battle);
    if (incoming) value = incoming.hits > 1 ? `${incoming.perHit}×${incoming.hits}` : `${incoming.perHit}`;
  } else if (intent.kind === 'roar') value = `+${intent.value}`;
  else if (intent.value > 0) value = `${intent.value}`;
  return { type, label: INTENT_TYPE_LABEL[type], icon: INTENT_TYPE_ICON[type], value };
}

/* ---------- Card-play motion ---------- */

/** The card that just left your hand by being played (same turn, one card fewer), for a short fly-out. */
export function playedCard(
  prev: Pick<Battle, 'turn' | 'hand' | 'feedback'> | null,
  next: Pick<Battle, 'turn' | 'hand' | 'feedback'>,
): DeckCard | null {
  if (!prev || prev.turn !== next.turn || prev.feedback.seq === next.feedback.seq) return null;
  const kept = new Set(next.hand.map((card) => card.uid));
  const gone = prev.hand.filter((card) => !kept.has(card.uid));
  return gone.length === 1 ? gone[0].id : null;
}
