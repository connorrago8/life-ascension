/** Invite links stay on this site and survive the sign-in return path. */

export const COMPANION_INVITE_STORAGE_KEY = 'life-ascension-companion-invite';

export function companionInvitePath(code: string): string {
  return `/companion?invite=${encodeURIComponent(code.trim().toLowerCase())}`;
}

export function readInviteCode(search: string): string {
  const value = new URLSearchParams(search.startsWith('?') ? search : `?${search}`).get('invite')?.trim() ?? '';
  return /^[0-9a-f]{8,64}$/i.test(value) ? value.toLowerCase() : '';
}
