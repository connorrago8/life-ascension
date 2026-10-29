import { act, availableActions, type ActionId, type BattleState } from './engine.ts';
import { STARTER_ABILITIES } from './abilities.ts';
import { resolveElementalTurn, type ElementalState } from './elemental.ts';

/** Experimental adapter: keeps the existing Crypt reducer unchanged. */
export type ExpandedAction = ActionId | 'ember-bolt' | 'frost-shard';
export type ExpandedBattle = { battle: BattleState; effects: ElementalState };

export function createExpandedBattle(battle: BattleState): ExpandedBattle {
  return {
    battle,
    effects: {
      playerHp: battle.player.hp,
      enemyHp: battle.enemy.hp,
      enemyAttack: battle.enemy.attack,
      burn: 0,
      chill: 0,
    },
  };
}

export function expandedActions(state: ExpandedBattle): ExpandedAction[] {
  if (state.battle.status !== 'ongoing') return [];
  return [...availableActions(state.battle), 'ember-bolt', 'frost-shard'];
}

export function expandedAct(state: ExpandedBattle, action: ExpandedAction): ExpandedBattle {
  if (state.battle.status !== 'ongoing') return state;
  if (action !== 'ember-bolt' && action !== 'frost-shard') {
    const battle = act(state.battle, action);
    return {
      battle,
      effects: {
        ...state.effects,
        playerHp: battle.player.hp,
        enemyHp: battle.enemy.hp,
        enemyAttack: battle.enemy.attack,
      },
    };
  }
  const ability = STARTER_ABILITIES.find((entry) => entry.id === action);
  if (!ability) return state;
  const result = resolveElementalTurn({
    ...state.effects,
    playerHp: state.battle.player.hp,
    enemyHp: state.battle.enemy.hp,
    enemyAttack: state.battle.enemy.attack,
  }, ability);
  const battle: BattleState = {
    ...state.battle,
    player: { ...state.battle.player, hp: result.state.playerHp },
    enemy: { ...state.battle.enemy, hp: result.state.enemyHp },
    turn: state.battle.turn + (result.state.enemyHp > 0 && result.state.playerHp > 0 ? 1 : 0),
    status: result.state.enemyHp <= 0 ? 'won' : result.state.playerHp <= 0 ? 'lost' : 'ongoing',
    log: [
      ...state.battle.log,
      `${state.battle.player.name} casts ${ability.name} for ${result.damageDealt} total damage.`,
      `${state.battle.enemy.name} deals ${result.damageTaken} damage.`,
    ],
  };
  return { battle, effects: result.state };
}
