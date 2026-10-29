import { eventNode, FIGHT_ID, EVENT_ID, GUARDIAN_ID, fillTemplate, PLAYER, RAT, SENTINEL, TREASURE_ID, treasureNode } from './content.ts';
import { act, createBattle, type ActionId, type BattleState } from './engine.ts';

/** In-tab preview state. Nothing here is persisted or awarded as XP. */
export type Phase = 'intro' | 'gate' | 'map' | 'fight' | 'event' | 'treasure' | 'end';

export type RunState = {
  phase: Phase;
  seed: number;
  hp: number;
  maxHp: number;
  attackBonus: number;
  hint: string | null;
  eventChoiceId: string | null;
  outcomeNote: string | null;
  battle: BattleState | null;
  fightCleared: boolean;
  guardianCleared: boolean;
  sigilCollected: boolean;
  encounterId: typeof FIGHT_ID | typeof GUARDIAN_ID | null;
  eventCleared: boolean;
  treasureCleared: boolean;
  relicChoice: 'take' | 'leave' | null;
  hpAtFightStart: number | null;
  /** Increments on encounter entry and retry; not a reward or XP receipt. */
  fightAttempt: number;
};

export type RunCommand =
  | { type: 'continue' }
  | { type: 'back' }
  | { type: 'open'; nodeId: string }
  | { type: 'combat'; action: ActionId }
  | { type: 'retry-fight' }
  | { type: 'choose'; choiceId: string }
  | { type: 'choose-relic'; choice: 'take' | 'leave' }
  | { type: 'restart'; seed: number };

export type NodeAccess = 'done' | 'ready' | 'locked';

function safeSeed(seed: number): number {
  if (!Number.isFinite(seed)) return 1;
  return Math.floor(Math.abs(seed)) || 1;
}

export function createRun(seed: number): RunState {
  return {
    phase: 'intro',
    seed: safeSeed(seed),
    hp: PLAYER.maxHp,
    maxHp: PLAYER.maxHp,
    attackBonus: 0,
    hint: null,
    eventChoiceId: null,
    outcomeNote: null,
    battle: null,
    fightCleared: false,
    guardianCleared: false,
    sigilCollected: false,
    encounterId: null,
    eventCleared: false,
    treasureCleared: false,
    relicChoice: null,
    hpAtFightStart: null,
    fightAttempt: 0,
  };
}

function startBattle(state: RunState): BattleState {
  const guardian = state.encounterId === GUARDIAN_ID;
  const foe = guardian ? SENTINEL : RAT;
  return createBattle({
    // Separate deterministic streams so each encounter can be replayed independently.
    seed: guardian ? (state.seed ^ 0x5a17c0de) >>> 0 : state.seed,
    player: {
      id: PLAYER.id,
      name: PLAYER.name,
      hp: state.hp,
      maxHp: state.maxHp,
      attack: PLAYER.attack,
      heavy: PLAYER.heavy,
      attackBonus: state.attackBonus,
    },
    enemy: {
      id: foe.id,
      name: foe.name,
      hp: foe.maxHp,
      maxHp: foe.maxHp,
      attack: foe.attack,
    },
  });
}

export function nodeAccess(state: RunState, nodeId: string): NodeAccess {
  if (nodeId === FIGHT_ID) return state.fightCleared ? 'done' : 'ready';
  if (nodeId === EVENT_ID) {
    if (state.eventCleared) return 'done';
    return state.fightCleared ? 'ready' : 'locked';
  }
  if (nodeId === TREASURE_ID) {
    if (state.treasureCleared) return 'done';
    return state.eventCleared ? 'ready' : 'locked';
  }
  if (nodeId === GUARDIAN_ID) {
    if (state.guardianCleared) return 'done';
    return state.treasureCleared ? 'ready' : 'locked';
  }
  return 'locked';
}

export function reduceRun(state: RunState, command: RunCommand): RunState {
  if (command.type === 'restart') return createRun(command.seed);

  if (command.type === 'continue') {
    if (state.phase === 'intro') return { ...state, phase: 'gate' };
    if (state.phase === 'gate') return { ...state, phase: 'map' };
    if (state.phase === 'fight' && state.battle?.status === 'won') {
      return { ...state, phase: 'map', battle: null, encounterId: null, outcomeNote: null };
    }
    if (state.phase === 'event' && state.eventCleared) return { ...state, phase: 'map', outcomeNote: null };
    if (state.phase === 'treasure' && !state.treasureCleared) {
      // Preserve legacy Continue semantics for existing reducer callers; the UI presents explicit take/leave choices.
      const charm = treasureNode();
      return { ...state, phase: 'map', treasureCleared: true, relicChoice: 'take', attackBonus: state.attackBonus + charm.attackBonus };
    }
    if (state.phase === 'treasure' && state.treasureCleared) return { ...state, phase: 'map' };
    if (state.phase === 'map' && state.guardianCleared) return { ...state, phase: 'end' };
    return state;
  }

  if (command.type === 'back') {
    if (state.phase === 'gate') return { ...state, phase: 'intro' };
    if (state.phase === 'map') return { ...state, phase: 'gate' };
    if (state.phase === 'fight') {
      if (state.battle?.status === 'won') return { ...state, phase: 'map', battle: null, encounterId: null };
      // After defeat, restore full HP so Back cannot strand the player at an unwinnable checkpoint.
      // Retreating from an ongoing fight still restores only the pre-fight HP.
      const hp = state.battle?.status === 'lost' ? state.maxHp : state.hpAtFightStart ?? state.maxHp;
      return { ...state, phase: 'map', battle: null, encounterId: null, hp };
    }
    if (state.phase === 'event' || state.phase === 'treasure') return { ...state, phase: 'map', outcomeNote: null };
    if (state.phase === 'end') return { ...state, phase: 'map' };
    return state;
  }

  if (command.type === 'open') {
    if (state.phase !== 'map') return state;
    if (command.nodeId === FIGHT_ID && nodeAccess(state, FIGHT_ID) === 'ready') {
      const next = { ...state, phase: 'fight' as const, encounterId: FIGHT_ID, hpAtFightStart: state.hp, fightAttempt: state.fightAttempt + 1 };
      return { ...next, battle: startBattle(next) };
    }
    if (command.nodeId === GUARDIAN_ID && nodeAccess(state, GUARDIAN_ID) === 'ready') {
      const next = { ...state, phase: 'fight' as const, encounterId: GUARDIAN_ID, hpAtFightStart: state.hp, fightAttempt: state.fightAttempt + 1 };
      return { ...next, battle: startBattle(next) };
    }
    if (command.nodeId === EVENT_ID && nodeAccess(state, EVENT_ID) === 'ready') {
      return { ...state, phase: 'event', outcomeNote: null };
    }
    if (command.nodeId === TREASURE_ID && nodeAccess(state, TREASURE_ID) === 'ready') {
      return { ...state, phase: 'treasure' };
    }
    return state;
  }

  if (command.type === 'combat') {
    if (state.phase !== 'fight' || !state.battle || state.battle.status !== 'ongoing') return state;
    // Ignore stale combat commands for encounters already completed in this run.
    if (state.encounterId === FIGHT_ID && state.fightCleared) return state;
    if (state.encounterId === GUARDIAN_ID && state.guardianCleared) return state;
    const battle = act(state.battle, command.action);
    return {
      ...state,
      battle,
      hp: battle.player.hp,
      fightCleared: battle.status === 'won' && state.encounterId === FIGHT_ID ? true : state.fightCleared,
      guardianCleared: battle.status === 'won' && state.encounterId === GUARDIAN_ID ? true : state.guardianCleared,
      sigilCollected: battle.status === 'won' && state.encounterId === GUARDIAN_ID ? true : state.sigilCollected,
    };
  }

  if (command.type === 'retry-fight') {
    if (state.phase !== 'fight' || state.battle?.status !== 'lost') return state;
    // A guardian entered at critically low HP can be impossible to win, even on retry.
    // Restore full HP at this fight checkpoint without resetting earlier run progress.
    const hp = state.maxHp;
    const next = { ...state, hp, hpAtFightStart: hp, fightCleared: state.encounterId === FIGHT_ID ? false : state.fightCleared, fightAttempt: state.fightAttempt + 1, battle: null };
    return { ...next, battle: startBattle(next) };
  }

  if (command.type === 'choose-relic') {
    if (state.phase !== 'treasure' || state.treasureCleared) return state;
    const charm = treasureNode();
    return {
      ...state,
      phase: 'map',
      treasureCleared: true,
      relicChoice: command.choice,
      attackBonus: state.attackBonus + (command.choice === 'take' ? charm.attackBonus : 0),
      outcomeNote: command.choice === 'take'
        ? 'You take the Ember Charm. Its +2 damage lasts only for this preview run.'
        : 'You leave the Ember Charm on the plinth. The Sentinel will be harder to defeat, but the relic remains undisturbed.',
    };
  }

  if (command.type === 'choose') {
    if (state.phase !== 'event' || state.eventCleared) return state;
    const choice = eventNode().choices.find((item) => item.id === command.choiceId);
    if (!choice) return state;
    // The optional ember bargain costs exactly two HP for run-only damage.
    // Never reduce the Wayfarer below one HP from a narrative choice.
    const canPay = !choice.hpCost || state.hp > choice.hpCost;
    if (!canPay) {
      // A rejected offering must not consume the one-time inscription choice.
      return { ...state, outcomeNote: fillTemplate(choice.resultFull) };
    }
    const cost = choice.hpCost ?? 0;
    const healed = Math.min(state.maxHp, state.hp - cost + (choice.heal ?? 0)) - (state.hp - cost);
    const note = choice.hpCost
      ? fillTemplate(choice.result, { cost: String(cost) })
      : healed > 0
        ? fillTemplate(choice.result, { heal: String(healed) })
        : fillTemplate(choice.resultFull);
    return {
      ...state,
      hp: state.hp - cost + healed,
      attackBonus: state.attackBonus + (choice.attackBonus ?? 0),
      hint: choice.hint ? note : state.hint,
      eventChoiceId: choice.id,
      eventCleared: true,
      outcomeNote: note,
    };
  }

  return state;
}
