/**
 * Return a safe same-origin relative destination, or the home page.
 * Check both the raw input and the NORMALIZED URL path: URL resolution
 * collapses dot segments and can turn /..//host into //host.
 */
export function safeNext(next: string | null | undefined, origin: string): string {
 if (!next || /[\x00-\x1f\x7f]/.test(next) || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return '/';
 try {
  const u = new URL(next, origin);
  if (u.origin !== origin) return '/';
  const p = u.pathname + u.search + u.hash;
  return p.startsWith('/') && !p.startsWith('//') && !p.startsWith('/\\') ? p : '/';
 } catch {
  return '/';
 }
}
