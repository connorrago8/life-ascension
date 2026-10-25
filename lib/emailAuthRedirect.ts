/** Build the Supabase email return URL for the site that started the request. */
export function emailAuthRedirect(origin: string, nextPath: string): string {
  const base = origin.replace(/\/$/, '');
  return `${base}/auth/callback?next=${encodeURIComponent(nextPath)}`;
}
