'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { CSSProperties, MouseEvent, ReactNode } from 'react';
import { liveModeHref, useModeHref } from './ModeLink';
import { performInAppBack } from '../lib/inAppBack';

export function InAppBackLink({
  href,
  className,
  style,
  children,
}: {
  href: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const resolvedHref = useModeHref(href);
  let router: { replace: (href: string) => void } | null = null;
  try {
    router = useRouter();
  } catch {
    router = null;
  }
  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    const target = liveModeHref(href);
    event.currentTarget.setAttribute('href', target);
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    if (!router) {
      window.location.assign(target);
      return;
    }
    performInAppBack(router, target);
  }
  return <Link prefetch={false} href={resolvedHref} className={className} style={style} onClick={onClick}>{children}</Link>;
}
