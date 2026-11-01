'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { CSSProperties, MouseEvent, ReactNode } from 'react';
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
  let router: { replace: (href: string) => void } | null = null;
  try {
    router = useRouter();
  } catch {
    router = null;
  }
  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    if (!router) {
      window.location.assign(href);
      return;
    }
    performInAppBack(router, href);
  }
  return <Link href={href} className={className} style={style} onClick={onClick}>{children}</Link>;
}
