/** Who is using the app, decided only from companion_state. Cosmetic routing, not XP. */

export type SessionRole = 'companion' | 'adventurer' | 'signed-out';

export type CompanionBondView = {
  role?: string | null;
  status?: string | null;
} | null;

export function roleFromCompanionState(input: {
  signedIn: boolean;
  bond?: CompanionBondView;
} | null | undefined): SessionRole {
  if (!input?.signedIn) return 'signed-out';
  if (input.bond?.status === 'active' && input.bond.role === 'companion') return 'companion';
  return 'adventurer';
}

/** One primary nav. Play is omitted for companion accounts; the route still softens instead of dead-ending. */
export const COMPANION_NAV = [
  { href: '/', label: 'Home' },
  { href: '/quests', label: 'Quests' },
  { href: '/character', label: 'Character' },
  { href: '/more', label: 'More' },
] as const;

const LEGACY_EXACT: Record<string, string> = {
  '/companion/home': '/',
  '/companion/quests': '/quests',
  '/companion/character': '/character',
  '/companion/rewards': '/more/rewards',
  '/companion/history': '/more/history',
  '/companion/log': '/log',
};

/** Old companion and together URLs resolve to the shared homes. Invite codes stay on the relationship page. */
export function legacyDestination(pathname: string, search = ''): string | null {
  if (pathname === '/play/crypt' || pathname.startsWith('/play/crypt/')) return null;
  if (pathname === '/together' || pathname.startsWith('/together/')) return '/quests?chip=together';
  if (pathname === '/companion') {
    const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
    const invite = params.get('invite')?.trim() ?? '';
    return /^[0-9a-f]{8,64}$/i.test(invite)
      ? `/more/relationship?invite=${encodeURIComponent(invite.toLowerCase())}`
      : '/more/relationship';
  }
  if (LEGACY_EXACT[pathname]) return LEGACY_EXACT[pathname];
  if (pathname.startsWith('/companion/')) return '/more';
  return null;
}

export function isCompanionOnlyPath(pathname: string): boolean {
  return legacyDestination(pathname) !== null && (pathname === '/companion' || pathname.startsWith('/companion/'));
}

/** Adventurer surfaces companions now share, except Play which is softened in the hub. */
export function isAdventurerPath(pathname: string): boolean {
  if (pathname === '/') return true;
  return ['/quests', '/play', '/character', '/more', '/health', '/settings', '/log'].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function companionRedirect(pathname: string, _role: SessionRole, search = ''): string | null {
  return legacyDestination(pathname, search);
}

export function draftSourceLabel(source: unknown): 'AI organized' | 'Basic draft' | null {
  if (source === 'model') return 'AI organized';
  if (source === 'fallback') return 'Basic draft';
  return null;
}

type RoleCache = { userId: string; mode: Exclude<SessionRole, 'signed-out'> };
let roleCache: RoleCache | null = null;

export function readCompanionRoleCache(): RoleCache | null {
  return roleCache;
}

export function writeCompanionRoleCache(next: RoleCache | null): void {
  roleCache = next;
}

export function clearCompanionRoleCache(): void {
  roleCache = null;
}
