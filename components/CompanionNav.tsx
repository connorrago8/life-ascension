'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { COMPANION_NAV } from '../lib/companionAccess';

function current(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function CompanionNav() {
  const pathname = usePathname() || '/companion/home';
  return (
    <nav className="app-nav companion-nav" aria-label="Companion">
      <Link href="/companion/home" className="nav-brand">LIFE ASCENSION</Link>
      <div className="nav-links">
        {COMPANION_NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="nav-link"
            aria-current={current(pathname, item.href) ? 'page' : undefined}
          >
            <span>{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
