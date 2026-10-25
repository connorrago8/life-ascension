/**
 * Return a safe same-origin relative destination, or the home page.
 * Check both the raw input and the NORMALIZED URL path: URL resolution
 * collapses dot segments and can turn /..//host into //host.
 */
function sameOriginPath(path: string): string {
 if (!path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) return '/';
 let decoded = path;
 try {
  decoded = decodeURIComponent(path);
 } catch {
  return '/';
 }
 if (/[\x00-\x1f\x7f\\]/.test(decoded) || decoded.startsWith('//') || decoded.startsWith('/\\')) return '/';
 return path;
}

export function safeNext(next: string | null | undefined, origin: string): string {
 if (!next || /[\x00-\x1f\x7f]/.test(next) || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return '/';
 try {
  const u = new URL(next, origin);
  if (u.origin !== origin) return '/';
  return sameOriginPath(u.pathname + u.search + u.hash);
 } catch {
  return '/';
 }
}
