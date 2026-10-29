import type { AbilityDefinition, Effect } from './abilities.ts';

/**
 * Pure, deterministic prototype effects. This module deliberately does not
 * alter the existing four-action Crypt engine or persist any run state.
 */
export type ElementalState = {
  playerHp: number;
  enemyHp: number;
  enemyAttack: number;
  burn: number;
  chill: number;
};

export type ElementalResult = {
  state: ElementalState;
  damageDealt: number;
  damageTaken: number;
};

function nonnegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

/** Burn deals damage after the enemy acts; Chill reduces that enemy hit once. */
export function resolveElementalTurn(
  state: Readonly<ElementalState>,
  ability: Readonly<AbilityDefinition>,
): ElementalResult {
  if (!Number.isFinite(state.playerHp) || !Number.isFinite(state.enemyHp)
    || !Number.isFinite(state.enemyAttack) || !Number.isFinite(state.burn)
    || !Number.isFinite(state.chill) || state.playerHp < 0 || state.enemyHp < 0
    || state.enemyAttack < 0 || state.burn < 0 || state.chill < 0) {
    throw new Error('Invalid elemental combat state');
  }
  if (state.playerHp === 0 || state.enemyHp === 0) {
    return { state: { ...state }, damageDealt: 0, damageTaken: 0 };
  }
  let enemyHp = state.enemyHp;
  let burn = nonnegative(state.burn);
  let chill = nonnegative(state.chill);
  for (const effect of ability.effects) {
    if (effect.kind === 'damage') {
      enemyHp = Math.max(0, enemyHp - nonnegative(effect.amount));
    } else if (effect.kind === 'status' && effect.status === 'burn') {
      burn += nonnegative(effect.stacks);
    } else if (effect.kind === 'status' && effect.status === 'chill') {
      chill += nonnegative(effect.stacks);
    }
  }
  if (enemyHp === 0) {
    return {
      state: { ...state, enemyHp, burn, chill },
      damageDealt: state.enemyHp,
      damageTaken: 0,
    };
  }
  const damageTaken = Math.max(0, nonnegative(state.enemyAttack) - chill);
  const playerHp = Math.max(0, state.playerHp - damageTaken);
  // Burn is applied after the enemy's action, so Fire rewards sustained pressure.
  enemyHp = Math.max(0, enemyHp - burn);
  return {
    state: { ...state, playerHp, enemyHp, burn, chill: 0 },
    damageDealt: state.enemyHp - enemyHp,
    damageTaken: state.playerHp - playerHp,
  };
}
