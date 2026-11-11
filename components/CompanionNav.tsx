'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { COMPANION_NAV } from '../lib/companionAccess';

function current(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Icon({ href }: { href: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {href.endsWith('/home') && <path d="M4 11.5 12 4l8 7.5V20h-5v-6H9v6H4z" />}
      {href.endsWith('/quests') && <path d="M7 4h10v16H7zM9 8h6M9 12h6M9 16h4" />}
      {href.endsWith('/rewards') && <path d="M12 20s-7-4.4-7-9a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 4.6-7 9-7 9z" />}
      {href.endsWith('/character') && <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm-6 8a6 6 0 0 1 12 0" />}
    </svg>
  );
}

export function CompanionNav({ pathname }: { pathname?: string }) {
  const live = usePathname() || '/companion/home';
  const path = pathname ?? live;
  return (
    <nav className="app-nav companion-nav" aria-label="Companion">
      <Link href="/companion/home" className="nav-brand">LIFE ASCENSION</Link>
      <div className="nav-links">
        {COMPANION_NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="nav-link"
            aria-current={current(path, item.href) ? 'page' : undefined}
          >
            <Icon href={item.href} />
            <span>{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
