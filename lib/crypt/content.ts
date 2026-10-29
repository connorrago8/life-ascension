import type { ActionId } from './engine.ts';

/** Shown on every preview screen. Progress stays in the tab and grants nothing. */
export const PREVIEW_BANNER = 'Preview — progress is not saved and earns no XP';

export const HUB = {
  title: 'Adventure',
  lede: 'Choose your path.',
  enter: 'Enter →',
  locked: 'Locked',
  soon: 'Coming soon',
  preview: 'Preview',
  note: 'Real-life quests earn XP. Play is the adventure those quests will open. Finish a quest on your board to move your level. Play itself does not.',
  locations: [
    {
      id: 'forgotten-crypt',
      name: 'Forgotten Crypt',
      kind: 'preview' as const,
      icon: 'skull' as const,
      x: 30,
      y: 40,
      blurb: 'A short unsaved floor. The gate is open for a preview.',
    },
    {
      id: 'town',
      name: 'Town',
      kind: 'locked' as const,
      icon: 'house' as const,
      x: 74,
      y: 18,
      blurb: 'Locked. Coming soon.',
    },
    {
      id: 'whispering-woods',
      name: 'Whispering Woods',
      kind: 'locked' as const,
      icon: 'tree' as const,
      x: 70,
      y: 66,
      blurb: 'Locked. Coming soon.',
    },
  ],
  links: [
    ['forgotten-crypt', 'town'],
    ['forgotten-crypt', 'whispering-woods'],
    ['town', 'whispering-woods'],
  ] as const,
};

export const PLAYER = {
  id: 'wayfarer',
  name: 'Wayfarer',
  maxHp: 20,
  attack: 4,
  heavy: 8,
};

export const RAT = {
  id: 'crypt-rat',
  name: 'Crypt Rat',
  maxHp: 9,
  attack: 3,
};

export const SENTINEL = {
  id: 'crypt-sentinel',
  name: 'Crypt Sentinel',
  maxHp: 16,
  attack: 4,
};

export const SIGIL = {
  name: 'Sentinel Sigil',
  description: 'A run-only trophy. It grants no XP or permanent equipment.',
};

export const INTRO = {
  place: 'Brackenlight',
  speaker: 'Mira',
  role: 'Guide',
  lines: [
    'You are a Wayfarer, new on the road into Brackenlight.',
    'I am Mira. I keep the paths the town would rather forget, and I can walk you to the crypt gate.',
    'Go lightly. Nothing past this threshold is written down.',
  ],
  continue: 'Walk to the gate',
};

export const GATE = {
  title: 'Crypt gate',
  lines: [
    'The iron gate stands ajar. Cold air moves out of the dark.',
    'Floor 1 holds a rat, an inscription, and an Ember Charm. A sentinel guards the sealed door.',
  ],
  continue: 'Enter the crypt',
};

export const FLOOR = {
  title: 'Forgotten Crypt',
  floor: 'Floor 1',
  mapLabel: 'Floor Map',
  back: 'Back',
  restart: 'Restart',
  loading: 'Opening the preview…',
  door: 'Approach the sealed door',
  done: 'Done',
  open: 'Open',
  locked: 'Locked',
};

export type EventChoice = {
  id: string;
  label: string;
  result: string;
  resultFull: string;
  heal?: number;
  hint?: boolean;
  hpCost?: number;
  attackBonus?: number;
};

export type FightNode = {
  id: string;
  kind: 'fight';
  label: string;
  title: string;
  detail: string;
};

export type EventNode = {
  id: string;
  kind: 'event';
  label: string;
  title: string;
  detail: string;
  prose: string;
  continue: string;
  choices: readonly EventChoice[];
};

export type TreasureNode = {
  id: string;
  kind: 'treasure';
  label: string;
  title: string;
  detail: string;
  prose: string;
  take: string;
  attackBonus: number;
};

export type CryptNode = FightNode | EventNode | TreasureNode;

export const NODES: readonly CryptNode[] = [
  {
    id: 'fight-rat',
    kind: 'fight',
    label: 'Fight',
    title: 'Crypt Rat',
    detail: 'Something small skitters between the stones.',
  },
  {
    id: 'event-inscription',
    kind: 'event',
    label: 'Event',
    title: 'Ancient inscription',
    detail: 'Words cut into the wall still hold a little warmth.',
    prose: 'Letters older than Brackenlight are cut into the wall. Two lines still answer to a touch.',
    continue: 'Continue',
    choices: [
      {
        id: 'mend',
        label: 'Trace the mending line',
        result: 'Warmth closes a scrape. You recover {heal} HP for this preview only.',
        resultFull: 'The warmth finds you already whole. The words dim, and your HP stays full.',
        heal: 2,
      },
      {
        id: 'bargain',
        label: 'Offer blood to the ember rune',
        result: 'The rune takes {cost} HP and strengthens your strikes by +1 damage for this run.',
        resultFull: 'The rune takes {cost} HP and strengthens your strikes by +1 damage for this run.',
        hpCost: 2,
        attackBonus: 1,
      },
      {
        id: 'warning',
        label: 'Read the warning',
        result: 'The line says your {artifact} twitches when a door is sealed.',
        resultFull: 'The line says your {artifact} twitches when a door is sealed.',
        hint: true,
      },
    ],
  },
  {
    id: 'treasure-ember',
    kind: 'treasure',
    label: 'Treasure',
    title: 'Ember Charm',
    detail: 'A coal-warm charm on a broken plinth.',
    prose: 'The Ember Charm is hot to the touch and leaves no mark. While carried, it adds 2 base damage to Attack and Heavy Strike. Focus doubles the total Attack damage. It fades when you leave this preview.',
    take: 'Take the charm',
    attackBonus: 2,
  },
  {
    id: 'fight-sentinel',
    kind: 'fight',
    label: 'Guardian',
    title: SENTINEL.name,
    detail: 'The charm wakes an armored watcher at the sealed door.',
  },
];

export const FIGHT_ID = NODES[0].id;
export const EVENT_ID = NODES[1].id;
export const TREASURE_ID = NODES[2].id;
export const GUARDIAN_ID = NODES[3].id;

// Guide the current unsaved run; never imply account-level rewards.
export function nextCryptObjective(progress: {
  fightCleared: boolean;
  eventCleared: boolean;
  treasureCleared: boolean;
  guardianCleared: boolean;
}): string {
  if (!progress.fightCleared) return 'Defeat the Crypt Rat';
  if (!progress.eventCleared) return 'Read the ancient inscription';
  if (!progress.treasureCleared) return 'Take the Ember Charm';
  if (!progress.guardianCleared) return 'Defeat the Crypt Sentinel';
  return 'Approach the sealed door';
}

/**
 * Relic named on the end card.
 * Swap `artifact` (for example to crown-key) and every {artifact} sentence follows.
 * Components read these fields; they do not hard-code the relic.
 */
export const END_CARD = {
  title: 'A sealed door',
  artifact: 'broken compass',
  door: 'The passage ends at a door of black stone. There is no ring and no key.',
  twitch: 'Your {artifact} twitches once, then goes still.',
  kicker: 'To be continued.',
  restart: 'Restart preview',
  charm: 'Ember Charm adds +{bonus} base damage (Focus doubles Attack), this run only.',
  sigil: 'You recovered the Sentinel Sigil. It vanishes when this preview ends.',
};

export const COMBAT = {
  title: 'Combat',
  opening: 'A Crypt Rat blocks the stones.',
  guardianOpening: 'The Crypt Sentinel rises before the sealed door.',
  win: 'The Crypt Rat falls. The path ahead is quiet.',
  lose: 'You drop to the stones. This fight can be tried again.',
  guardianWin: 'The Crypt Sentinel crumbles. You recover its sigil for this run only.',
  guardianLose: 'The Crypt Sentinel drives you back. Retry with the same run-only charm.',
  retry: 'Retry',
  retreat: 'Return to floor map',
  continue: 'Continue',
  victory: 'Victory',
  defeat: 'Defeat',
  heavyWaiting: 'Not ready',
  focused: 'Focused',
  actions: [
    { id: 'attack' as ActionId, label: 'Attack', detail: 'A steady strike.' },
    { id: 'defend' as ActionId, label: 'Defend', detail: 'Halve the next hit.' },
    { id: 'heavy' as ActionId, label: 'Heavy Strike', detail: 'Harder, then it must rest.' },
    { id: 'focus' as ActionId, label: 'Focus', detail: 'Double the next Attack.' },
  ],
};

export function eventNode(): EventNode {
  const node = NODES.find((item) => item.kind === 'event');
  if (!node || node.kind !== 'event') throw new Error('Missing inscription');
  return node;
}

export function treasureNode(): TreasureNode {
  const node = NODES.find((item) => item.kind === 'treasure');
  if (!node || node.kind !== 'treasure') throw new Error('Missing treasure');
  return node;
}

export function fillTemplate(template: string, values: Record<string, string> = {}, artifact = END_CARD.artifact): string {
  const named = template.replaceAll('{artifact}', artifact);
  return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, value), named);
}

/** End-card copy. Pass another artifact name to preview a swap without editing components. */
export function endCardParagraphs(artifact = END_CARD.artifact): readonly string[] {
  return [END_CARD.door, fillTemplate(END_CARD.twitch, {}, artifact), END_CARD.kicker];
}

export function charmNote(bonus: number): string {
  return fillTemplate(END_CARD.charm, { bonus: String(bonus) });
}

export function wayfarerLabel(level: number | null): string {
  if (level == null) return PLAYER.name;
  return `${PLAYER.name} · Level ${level}`;
}

export function runStatus(hp: number, maxHp: number, bonus: number): string {
  const base = `${PLAYER.name} ${hp}/${maxHp}`;
  if (bonus > 0) return `${base} · Ember Charm +${bonus}`;
  return base;
}

export function turnLabel(turn: number): string {
  return `Turn ${turn} · Your turn.`;
}
