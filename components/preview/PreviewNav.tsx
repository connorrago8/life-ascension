'use client';

import { usePathname } from 'next/navigation';
import { usePreviewTransition } from './previewTransition';

const ITEMS = [
  { href: '/preview/home', label: 'Quests', icon: 'quests' },
  { href: '/preview/character', label: 'Character', icon: 'character' },
  { href: '/preview/adventure', label: 'Adventure', icon: 'adventure' },
  { href: '/preview/inventory', label: 'Inventory', icon: 'inventory' },
] as const;

function current(pathname: string, href: string) {
  if (href === '/preview/home') return pathname === '/preview/home' || pathname === '/preview/compare';
  return pathname === href;
}

export function PreviewNav() {
  const pathname = usePathname();
  const beginTransition = usePreviewTransition();

  return (
    <nav className="preview-nav" aria-label="Preview">
      {ITEMS.map((item) => {
        const active = current(pathname, item.href);
        if (item.href === '/preview/adventure') {
          return (
            <a
              key={item.href}
              href={item.href}
              className="preview-tab"
              aria-current={active ? 'page' : undefined}
              onClick={(event) => {
                event.preventDefault();
                beginTransition(item.href);
              }}
            >
              <TabIcon name={item.icon} />
              <span>{item.label}</span>
            </a>
          );
        }
        return (
          <a key={item.href} href={item.href} className="preview-tab" aria-current={active ? 'page' : undefined}>
            <TabIcon name={item.icon} />
            <span>{item.label}</span>
          </a>
        );
      })}
    </nav>
  );
}

function TabIcon({ name }: { name: (typeof ITEMS)[number]['icon'] }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {name === 'quests' && (
        <>
          <path d="M7 4.5h8.2A2.8 2.8 0 0 1 18 7.3V19H8.5" />
          <path d="M7 4.5A2.5 2.5 0 0 0 4.5 7v11.2A2.3 2.3 0 0 1 6.8 20" />
          <path d="M9.2 9.2h5.2M9.2 12.4h5.2M9.2 15.6h3.2" />
        </>
      )}
      {name === 'character' && (
        <>
          <circle cx="12" cy="8.2" r="3.1" />
          <path d="M5.6 19.2c1.1-2.8 3.4-4.2 6.4-4.2s5.3 1.4 6.4 4.2" />
        </>
      )}
      {name === 'adventure' && (
        <>
          <path d="M4 16.5 12 4l8 12.5" />
          <path d="M7.2 16.5h9.6L12 9.2z" />
        </>
      )}
      {name === 'inventory' && (
        <>
          <rect x="4" y="7" width="16" height="12" rx="2" />
          <path d="M9 7V5.8A1.8 1.8 0 0 1 10.8 4h2.4A1.8 1.8 0 0 1 15 5.8V7" />
        </>
      )}
    </svg>
  );
}
