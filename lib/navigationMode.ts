/** Carry only the existing dev-preview marker across authored internal links.
 * This grants no preview/account authority; each destination retains its gate.
 */
export function navigationModeHref(href: string, search: string, development: boolean): string {
  if (!development || !href.startsWith('/') || href.startsWith('//') || new URLSearchParams(search).get('preview') !== '1') return href;
  const url = new URL(href, 'https://local.invalid');
  if (url.searchParams.has('preview')) return href; // Explicit destination mode wins.
  url.searchParams.set('preview', '1');
  return url.pathname + url.search + url.hash;
}
