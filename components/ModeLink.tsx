'use client';

import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, type ComponentProps, type MouseEvent } from 'react';
import { navigationModeHref } from '../lib/navigationMode';

export function liveModeHref(href: string): string {
  return navigationModeHref(href, window.location.search, process.env.NODE_ENV === 'development');
}

/** Resolve in the same render as the current query, including query-only changes.
 * Callers provide a Suspense boundary for static production rendering. */
export function useModeHref(href: string): string {
  const search = useSearchParams();
  return navigationModeHref(href, search?.toString() ?? '', process.env.NODE_ENV === 'development');
}

type Props = Omit<ComponentProps<typeof Link>, 'href' | 'onClick'> & { href: string; onClick?: (event: MouseEvent<HTMLAnchorElement>) => void };
export function ModeLink(props: Props) {
  return <Suspense fallback={<span className={props.className} style={props.style} aria-disabled="true" aria-busy="true">{props.children}</span>}><ResolvedModeLink {...props} /></Suspense>;
}
function ResolvedModeLink({ href, onClick, ...props }: Props) {
  const router = useRouter(), resolved = useModeHref(href);
  return <Link {...props} href={resolved} prefetch={false} onClick={event => {
    onClick?.(event); if (event.defaultPrevented) return;
    const target = liveModeHref(href);
    // Native modified-click navigation uses the anchor's current href.
    event.currentTarget.setAttribute('href', target);
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0 || (event.currentTarget.target && event.currentTarget.target !== '_self') || event.currentTarget.hasAttribute('download')) return;
    event.preventDefault(); router.push(target);
  }} />;
}
