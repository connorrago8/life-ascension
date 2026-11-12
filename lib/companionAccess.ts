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

export const COMPANION_NAV = [
  { href: '/companion/home', label: 'Home' },
  { href: '/companion/quests', label: 'Quests' },
  { href: '/companion/character', label: 'Character' },
  { href: '/companion/history', label: 'History' },
] as const;

const COMPANION_ONLY = ['/companion/home', '/companion/quests', '/companion/rewards', '/companion/character', '/companion/history', '/companion/log'] as const;

export function isCompanionOnlyPath(pathname: string): boolean {
  return COMPANION_ONLY.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** Adventurer surfaces. /companion itself stays open as the invite fallback. The no-account Crypt preview is not listed. */
export function isAdventurerPath(pathname: string): boolean {
  if (pathname === '/') return true;
  return ['/quests', '/play', '/character', '/health', '/settings'].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function companionRedirect(pathname: string, role: SessionRole): string | null {
  if (pathname === '/play/crypt' || pathname.startsWith('/play/crypt/')) return null;
  if (role === 'companion' && isAdventurerPath(pathname)) return '/companion/home';
  if (role !== 'companion' && isCompanionOnlyPath(pathname)) return '/';
  return null;
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
