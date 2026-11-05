'use client';

import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useSyncExternalStore, type ComponentProps, type MouseEvent } from 'react';
import { navigationModeHref } from '../lib/navigationMode';

export function liveModeHref(href: string): string {
  return navigationModeHref(href, window.location.search, process.env.NODE_ENV === 'development');
}

const browserSearch = () => window.location.search;
function subscribeBrowserSearch(changed: () => void) {
  window.addEventListener('popstate', changed);
  window.addEventListener('pageshow', changed);
  return () => {
    window.removeEventListener('popstate', changed);
    window.removeEventListener('pageshow', changed);
  };
}

/** Keep SSR and the first hydration render independent of a mutable URL.
 * Next notifies normal query changes; the browser snapshot supplies live mode.
 * Null means a noninteractive placeholder until client hydration is complete. */
export function useModeHref(href: string): string | null {
  useSearchParams();
  const currentSearch = useSyncExternalStore(subscribeBrowserSearch, browserSearch, () => null);
  return currentSearch === null ? null : navigationModeHref(href, currentSearch, process.env.NODE_ENV === 'development');
}

type Props = Omit<ComponentProps<typeof Link>, 'href' | 'onClick'> & { href: string; onClick?: (event: MouseEvent<HTMLAnchorElement>) => void };
export function ModeLink(props: Props) {
  return <Suspense fallback={<span className={props.className} style={props.style} aria-disabled="true" aria-busy="true">{props.children}</span>}><ResolvedModeLink {...props} /></Suspense>;
}
function ResolvedModeLink({ href, onClick, ...props }: Props) {
  const router = useRouter(), resolved = useModeHref(href);
  if (resolved === null) return <span className={props.className} style={props.style} aria-disabled="true" aria-busy="true">{props.children}</span>;
  return <Link {...props} href={resolved} prefetch={false} onClick={event => {
    onClick?.(event); if (event.defaultPrevented) return;
    const target = liveModeHref(href);
    // Native modified-click navigation uses the anchor's current href.
    event.currentTarget.setAttribute('href', target);
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0 || (event.currentTarget.target && event.currentTarget.target !== '_self') || event.currentTarget.hasAttribute('download')) return;
    event.preventDefault(); router.push(target);
  }} />;
}
