import { endTurn, playCard, startBattle, type Battle } from './battle.ts';
import { CARDS, MAX_DECK_SIZE, REWARD_POOL, cardDef, isUpgraded, upgradedKey, type CardId, type DeckCard } from './cards.ts';
import { BOSS, FLOOR_ROWS, REST_HEAL, checkChance, eventById, generateFloor, spawnFoe, type Room } from './floor.ts';
import { gearAttributes, isUpgrade, loadoutCards, loadoutPassives, lootById, rollLoot, type Loadout, type LootSource } from './loot.ts';
import { nextIndex, nextRoll, seedRng, type Rng } from './rng.ts';
import { starterById, starterCards, type StarterId } from './starters.ts';
import {
  ZERO_ATTRIBUTES, addAttributes, clampAllocation, maxHpFor, type Attributes,
} from './stats.ts';

/**
 * One Crypt delve, held only in this tab. Run progress is NOT saved mid-floor:
 * leaving the page or signing out ends the run. Gear you found is reported to the
 * caller as it drops (so it can be kept), and the floor checkpoint is reported only
 * when a floor is cleared. This reducer never grants XP itself.
 */
export type DelvePhase = 'deck-select' | 'start-pick' | 'map' | 'combat' | 'reward' | 'event' | 'treasure' | 'rest' | 'floor-clear' | 'defeat';

/**
 * `worn` is true only after the player taps Wear on this drop. Gear is never
 * equipped automatically: drops go to the vault (and this run's found list).
 */
export type Reward = { cards: CardId[]; picked: boolean; loot: string | null; worn: boolean };
export type EventState = { eventId: string; outcome: string | null };

export type DelveState = {
  runId: string;
  seed: number;
  rng: Rng;
  floor: number;
  level: number;
  allocated: Attributes;
  runBonus: Attributes;
  loadout: Loadout;
  /** Gear found this run, in drop order. Index = drop index for the vault claim. */
  found: string[];
  deck: DeckCard[];
  /** Starter deck chosen on the deck-select screen. Missing/null = the default starting deck. */
  starter?: StarterId | null;
  /** Card upgrades you may pick right now (treasure chests and some mystery rooms). */
  upgrades: number;
  hp: number;
  maxHp: number;
  rows: Room[][];
  /** Index of the row you are choosing in. FLOOR_ROWS means the boss. */
  row: number;
  path: number[];
  phase: DelvePhase;
  /** Opening variety: the two cards offered before the first room (pick one). */
  startPick: CardId[];
  room: Room | null;
  battle: Battle | null;
  reward: Reward | null;
  event: EventState | null;
  note: string | null;
};

export type DelveCommand =
  | { type: 'choose-room'; row: number; index: number }
  | { type: 'play'; uid: number }
  | { type: 'end-turn' }
  | { type: 'pick-card'; cardId: CardId | null }
  /** Start of a run: add one of the two offered cards to your deck. */
  | { type: 'pick-start'; cardId: CardId }
  /** Run start (deck-select phase): pick one of the four starter decks. */
  | { type: 'pick-deck'; deckId: StarterId }
  | { type: 'event-option'; optionId: string }
  /** Campfire: heal, OR remove one card (by deck index). */
  | { type: 'rest'; choice: 'heal' }
  | { type: 'rest'; choice: 'remove'; index: number }
  /** Treasure / mystery: upgrade one card (by deck index) into its "+" version. */
  | { type: 'upgrade-card'; index: number }
  /** Explicit Wear: put on the gear that just dropped (reward, chest or mystery room) for the rest of this run. */
  | { type: 'wear'; itemId: string }
  | { type: 'continue' };

/** You always keep at least this many cards (one full hand). */
export const MIN_DECK_SIZE = 5;

export function canRemoveCard(state: Pick<DelveState, 'deck'>): boolean {
  return state.deck.length > MIN_DECK_SIZE;
}

/** Campfire removal preview (display only): deck size before and after removing the card at `index`. */
export function removalPreview(deck: readonly DeckCard[], index: number): {
  key: DeckCard; name: string; before: number; after: number; allowed: boolean;
} | null {
  const key = deck[index];
  if (!key) return null;
  const allowed = deck.length > MIN_DECK_SIZE;
  return { key, name: cardDef(key).name, before: deck.length, after: allowed ? deck.length - 1 : deck.length, allowed };
}

export function canUpgradeCard(state: Pick<DelveState, 'deck' | 'upgrades' | 'phase'>, index: number): boolean {
  const key = state.deck[index];
  return state.upgrades > 0 && (state.phase === 'treasure' || state.phase === 'event') && !!key && !isUpgraded(key);
}

export function effectiveAttributes(state: Pick<DelveState, 'allocated' | 'runBonus' | 'loadout'>): Attributes {
  return addAttributes(addAttributes(state.allocated, state.runBonus), gearAttributes(state.loadout));
}

/**
 * The Crypt loadout worn for one run. Nothing carries over between runs: it is
 * built only from the ids the player chose to wear at camp this visit, and each
 * must be in the vault (owned) and fit its slot. Gear found mid-run may be worn
 * for the rest of that run, then the next run starts with nothing worn again.
 */
export function runLoadout(vaultItemIds: readonly string[], wear: readonly string[]): Loadout {
  const owned = new Set(vaultItemIds);
  const loadout: Loadout = {};
  for (const id of wear) {
    const entry = lootById(id);
    if (entry && owned.has(id) && !loadout[entry.slot]) loadout[entry.slot] = entry.id;
  }
  return loadout;
}

export function createDelve(input: {
  runId: string; seed: number; level: number; allocated: Attributes; vaultItemIds?: readonly string[];
  /** Vault items the player chose to wear at camp for this run. Defaults to none. */
  wear?: readonly string[];
  /** Open on the starter deck-select screen (the game UI). Without it the run uses the default deck. */
  deckSelect?: boolean;
}): DelveState {
  const level = Math.max(1, Math.floor(input.level) || 1);
  const allocated = clampAllocation(input.allocated, level);
  const loadout = runLoadout(input.vaultItemIds ?? [], input.wear ?? []);
  const floor = generateFloor(seedRng(input.seed));
  const base = { allocated, runBonus: { ...ZERO_ATTRIBUTES }, loadout };
  const maxHp = maxHpFor(effectiveAttributes(base), level);
  // Own stream so the opening offer never shifts the floor layout or the fights.
  const startPick = rewardCards(seedRng((input.seed ^ 0x5eed) >>> 0), 2)[0];
  return {
    runId: input.runId, seed: input.seed, rng: floor.rng, floor: 1, level, ...base,
    found: [], deck: starterCards(null), starter: null, upgrades: 0, hp: maxHp, maxHp,
    rows: floor.rows, row: 0, path: [], phase: input.deckSelect ? 'deck-select' : 'start-pick', startPick, room: null, battle: null, reward: null, event: null, note: null,
  };
}

function refreshMaxHp(state: DelveState): DelveState {
  const maxHp = maxHpFor(effectiveAttributes(state), state.level);
  const gained = Math.max(0, maxHp - state.maxHp);
  return { ...state, maxHp, hp: Math.min(maxHp, state.hp + gained) };
}

/** Roll gear and record it as found (it goes to the vault). Never equips it: the player taps Wear. */
function dropLoot(state: DelveState, source: LootSource): { state: DelveState; itemId: string | null } {
  const [entry, rng] = rollLoot(state.rng, source, effectiveAttributes(state).luck);
  const next = { ...state, rng };
  if (!entry) return { state: next, itemId: null };
  return { state: { ...next, found: [...next.found, entry.id] }, itemId: entry.id };
}

/** Phases where the gear that just dropped can be worn with an explicit Wear tap. */
const WEAR_PHASES: readonly DelvePhase[] = ['reward', 'treasure', 'event'];

/** Can the player tap Wear on `itemId` right now? Only the drop on screen, only once. */
export function canWearDrop(state: Pick<DelveState, 'phase' | 'reward' | 'loadout'>, itemId: string): boolean {
  const reward = state.reward;
  if (!reward || reward.worn || reward.loot !== itemId || !WEAR_PHASES.includes(state.phase)) return false;
  const entry = lootById(itemId);
  return !!entry && state.loadout[entry.slot] !== entry.id;
}

/** Display helper: what Wear would replace, and whether it scores higher than what is worn. */
export function wearPreview(loadout: Loadout, itemId: string): { replaces: string | null; better: boolean } | null {
  const entry = lootById(itemId);
  if (!entry) return null;
  const current = loadout[entry.slot] ? lootById(loadout[entry.slot] as string) : null;
  return { replaces: current?.name ?? null, better: isUpgrade(loadout, entry) };
}

function rewardCards(rng: Rng, count = 3): [CardId[], Rng] {
  const pool = REWARD_POOL.slice();
  const picks: CardId[] = [];
  let state = rng;
  for (let i = 0; i < count && pool.length > 0; i += 1) {
    const [index, next] = nextIndex(state, pool.length);
    state = next;
    picks.push(pool.splice(index, 1)[0]);
  }
  return [picks, state];
}

export function currentRoomChoices(state: DelveState): readonly Room[] {
  if (state.row >= FLOOR_ROWS) return [{ kind: 'fight', foeId: BOSS.id }];
  return state.rows[state.row] ?? [];
}

function enterRoom(state: DelveState, room: Room): DelveState {
  const base = { ...state, room, note: null, path: [...state.path] };
  if (room.kind === 'fight' || room.kind === 'elite') {
    const foe = spawnFoe(room.foeId ?? '', state.row);
    const [battleSeed, rng] = nextRoll(state.rng);
    const battle = startBattle({
      rng: seedRng(Math.floor(battleSeed * 4294967295)), deck: [...state.deck, ...loadoutCards(state.loadout)],
      attributes: effectiveAttributes(state), hp: state.hp, maxHp: state.maxHp, foe, passives: loadoutPassives(state.loadout),
    });
    return { ...base, rng, phase: 'combat', battle };
  }
  if (room.kind === 'event') return { ...base, phase: 'event', event: { eventId: room.eventId ?? '', outcome: null } };
  if (room.kind === 'rest') return { ...base, phase: 'rest' };
  const drop = dropLoot(base, 'treasure');
  return { ...drop.state, phase: 'treasure', upgrades: 1, reward: { cards: [], picked: true, loot: drop.itemId, worn: false } };
}

function advance(state: DelveState): DelveState {
  return { ...state, phase: 'map', row: state.row + 1, room: null, battle: null, reward: null, event: null, upgrades: 0 };
}

export function reduceDelve(state: DelveState, command: DelveCommand): DelveState {
  if (state.phase === 'defeat' || state.phase === 'floor-clear') return state;

  if (command.type === 'choose-room') {
    if (state.phase !== 'map' || command.row !== state.row) return state;
    const room = currentRoomChoices(state)[command.index];
    if (!room) return state;
    return enterRoom({ ...state, path: [...state.path, command.index] }, room);
  }

  if (command.type === 'play' || command.type === 'end-turn') {
    if (state.phase !== 'combat' || !state.battle || state.battle.status !== 'ongoing') return state;
    const battle = command.type === 'play' ? playCard(state.battle, command.uid) : endTurn(state.battle);
    if (battle === state.battle) return state;
    let next: DelveState = { ...state, battle, hp: battle.hp };
    if (battle.status === 'lost') return { ...next, phase: 'defeat', hp: 0 };
    if (battle.status === 'won') {
      const boss = state.row >= FLOOR_ROWS;
      const drop = dropLoot(next, boss ? 'boss' : state.room?.kind === 'elite' ? 'elite' : 'fight');
      next = drop.state;
      if (boss) {
        return { ...next, phase: 'floor-clear', reward: { cards: [], picked: true, loot: drop.itemId, worn: false } };
      }
      const [cards, rng] = rewardCards(next.rng);
      return { ...next, rng, phase: 'reward', reward: { cards, picked: false, loot: drop.itemId, worn: false } };
    }
    return next;
  }

  if (command.type === 'pick-deck') {
    const starter = starterById(command.deckId);
    if (state.phase !== 'deck-select' || !starter) return state;
    return { ...state, phase: 'start-pick', starter: starter.id, deck: starterCards(starter.id), note: null };
  }

  if (command.type === 'pick-start') {
    if (state.phase !== 'start-pick' || !state.startPick.includes(command.cardId)) return state;
    return {
      ...state, phase: 'map', startPick: [], deck: [...state.deck, command.cardId],
      note: `${CARDS[command.cardId].name} added to your deck.`,
    };
  }

  if (command.type === 'pick-card') {
    if (state.phase !== 'reward' || !state.reward || state.reward.picked) return state;
    const valid = command.cardId === null || state.reward.cards.includes(command.cardId);
    if (!valid) return state;
    const added = !!command.cardId && state.deck.length < MAX_DECK_SIZE;
    const deck = added && command.cardId ? [...state.deck, command.cardId] : state.deck;
    const note = !command.cardId
      ? 'You skip the card.'
      : added
        ? `${CARDS[command.cardId].name} added to your deck.`
        : `Your deck is full (${MAX_DECK_SIZE} cards), so ${CARDS[command.cardId].name} was not added.`;
    return { ...advance({ ...state, deck }), note };
  }

  if (command.type === 'event-option') {
    if (state.phase !== 'event' || !state.event || state.event.outcome !== null) return state;
    const event = eventById(state.event.eventId);
    const option = event.options.find((entry) => entry.id === command.optionId);
    if (!option) return state;
    let next = { ...state };
    let outcome = option.success;
    if (option.check) {
      const [roll, rng] = nextRoll(next.rng);
      next.rng = rng;
      const points = effectiveAttributes(next)[option.check];
      if (roll >= checkChance(points) && option.failure) outcome = option.failure;
    }
    let text = outcome.text;
    if (outcome.strength) {
      next = refreshMaxHp({ ...next, runBonus: addAttributes(next.runBonus, { strength: outcome.strength }) });
    }
    if (outcome.hp) next.hp = Math.max(1, Math.min(next.maxHp, next.hp + outcome.hp));
    if (outcome.upgrade) next.upgrades = 1;
    if (outcome.healPercent) next.hp = Math.min(next.maxHp, next.hp + Math.ceil(next.maxHp * outcome.healPercent));
    let reward: Reward | null = null;
    if (outcome.loot) {
      const drop = dropLoot(next, 'event');
      next = drop.state;
      reward = { cards: [], picked: true, loot: drop.itemId, worn: false };
      const entry = drop.itemId ? lootById(drop.itemId) : null;
      if (entry) text = `${text} Found: ${entry.name}.`;
    }
    return { ...next, reward, event: { ...state.event, outcome: text } };
  }

  if (command.type === 'rest') {
    if (state.phase !== 'rest') return state;
    if (command.choice === 'heal') {
      const healed = Math.min(state.maxHp - state.hp, Math.ceil(state.maxHp * REST_HEAL));
      return { ...advance({ ...state, hp: state.hp + healed }), note: `You rest by the fire and recover ${healed} HP.` };
    }
    if (command.choice !== 'remove') return state;
    const key = state.deck[command.index];
    if (!key || !canRemoveCard(state)) return state;
    const deck = state.deck.filter((_, i) => i !== command.index);
    return { ...advance({ ...state, deck }), note: `You remove ${cardDef(key).name} from your deck. It is leaner now.` };
  }

  if (command.type === 'upgrade-card') {
    if (!canUpgradeCard(state, command.index)) return state;
    const key = state.deck[command.index];
    const deck = state.deck.slice();
    deck[command.index] = upgradedKey(key);
    return { ...state, deck, upgrades: state.upgrades - 1, note: `${cardDef(deck[command.index]).name}: ${cardDef(deck[command.index]).text}` };
  }

  if (command.type === 'wear') {
    if (!canWearDrop(state, command.itemId) || !state.reward) return state;
    const entry = lootById(command.itemId);
    if (!entry) return state;
    const worn = refreshMaxHp({ ...state, loadout: { ...state.loadout, [entry.slot]: entry.id } });
    return { ...worn, reward: { ...state.reward, worn: true } };
  }

  if (command.type === 'continue') {
    if (state.phase === 'treasure') return advance(state);
    if (state.phase === 'event' && state.event?.outcome) return advance(state);
    return state;
  }
  return state;
}
