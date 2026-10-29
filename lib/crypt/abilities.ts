/** Reusable elemental effect definitions; no changes to existing Crypt combat behavior. */
export type Element = 'fire' | 'ice' | 'lightning' | 'shadow' | 'light';
export type Effect =
  | { kind: 'damage'; amount: number }
  | { kind: 'status'; status: 'burn' | 'chill' | 'shock' | 'mark' | 'bleed' | 'ward'; stacks: number };

export type AbilityDefinition = {
  id: string;
  name: string;
  element: Element;
  energyCost: number;
  effects: readonly Effect[];
};

export const STARTER_ABILITIES: readonly AbilityDefinition[] = [
  {
    id: 'ember-bolt',
    name: 'Ember Bolt',
    element: 'fire',
    energyCost: 1,
    effects: [
      { kind: 'damage', amount: 4 },
      { kind: 'status', status: 'burn', stacks: 1 },
    ],
  },
  {
    id: 'frost-shard',
    name: 'Frost Shard',
    element: 'ice',
    energyCost: 1,
    effects: [
      { kind: 'damage', amount: 3 },
      { kind: 'status', status: 'chill', stacks: 1 },
    ],
  },
] as const;

export function validateAbility(ability: AbilityDefinition): boolean {
  return Boolean(ability.id && ability.name)
    && Number.isInteger(ability.energyCost)
    && ability.energyCost >= 0
    && ability.effects.every((effect) =>
      Number.isInteger(effect.kind === 'damage' ? effect.amount : effect.stacks)
      && (effect.kind === 'damage' ? effect.amount : effect.stacks) >= 0
    );
}
