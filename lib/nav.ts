/** Primary navigation. Health is folded into Character, not its own tab. */
export const NAV_ITEMS = [
  { id: 'home', href: '/', label: 'Home' },
  { id: 'quests', href: '/quests', label: 'Quests' },
  { id: 'play', href: '/play', label: 'Hub' },
  { id: 'character', href: '/character', label: 'Character' },
  { id: 'more', href: null, label: 'More' },
] as const;

export type NavItem = (typeof NAV_ITEMS)[number];
