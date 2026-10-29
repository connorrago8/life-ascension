'use client';

import { usePathname } from 'next/navigation';
import { AppNav } from './AppNav';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/';

  // The run-only Crypt is a standalone, no-account preview. Do not mount
  // global navigation there: its auth observer and Link prefetches can issue
  // unrelated requests to account routes and cloud services.
  if (pathname === '/play/crypt' || pathname.startsWith('/play/crypt/')) {
    return <>{children}</>;
  }

  return (
    <div className="shell">
      <AppNav />
      <div className="shell-main">{children}</div>
    </div>
  );
}
