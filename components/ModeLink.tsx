'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ComponentProps, type MouseEvent } from 'react';
import { navigationModeHref } from '../lib/navigationMode';

export function liveModeHref(href: string): string {
  return navigationModeHref(href, window.location.search, process.env.NODE_ENV === 'development');
}

/** Render a real href, with a fresh click-time read for early/modified activation. */
export function useModeHref(href: string): string {
  const pathname = usePathname();
  const [resolved, setResolved] = useState(href);
  useEffect(() => { setResolved(liveModeHref(href)); }, [href, pathname]);
  return resolved;
}

type Props = Omit<ComponentProps<typeof Link>, 'href' | 'onClick'> & { href: string; onClick?: (event: MouseEvent<HTMLAnchorElement>) => void };
export function ModeLink({ href, onClick, ...props }: Props) {
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
