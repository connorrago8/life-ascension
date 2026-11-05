'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Suspense, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { liveModeHref, useModeHref } from './ModeLink';
import { performInAppBack } from '../lib/inAppBack';

type Props = { href: string; className?: string; style?: CSSProperties; children: ReactNode };
export function InAppBackLink(props: Props) {
  return <Suspense fallback={<span className={props.className} style={props.style} aria-disabled="true" aria-busy="true">{props.children}</span>}><ResolvedBackLink {...props} /></Suspense>;
}
function ResolvedBackLink({ href, className, style, children }: Props) {
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
  if (resolvedHref === null) return <span className={className} style={style} aria-disabled="true" aria-busy="true">{children}</span>;
  return <Link prefetch={false} href={resolvedHref} className={className} style={style} onClick={onClick}>{children}</Link>;
}
