/** Primary navigation. Health and Finance are category pages, not tabs. */
export const NAV_ITEMS = [
  { id: 'home', href: '/', label: 'Home' },
  { id: 'quests', href: '/quests', label: 'Quests' },
  { id: 'character', href: '/character', label: 'Character' },
  { id: 'play', href: '/play', label: 'Play' },
  { id: 'izzy', href: '/izzy', label: 'Izzy' },
] as const;

export type NavItem = (typeof NAV_ITEMS)[number];
