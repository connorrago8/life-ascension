'use client';

import { usePathname } from 'next/navigation';
import { companionRedirect } from '../../lib/companionAccess';
import { EngagementChrome } from '../../components/EngagementChrome';
import { AppNav } from './AppNav';
import { CompanionNav } from '../../components/CompanionNav';
import { RoleRedirect } from '../../components/RoleRedirect';
import { useCompanionRole } from '../../components/useCompanionRole';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/';
  const crypt = pathname === '/play/crypt' || pathname.startsWith('/play/crypt/');
  const role = useCompanionRole(!crypt);

  // The run-only Crypt is a standalone, no-account preview. Do not mount
  // global navigation there: its auth observer and Link prefetches can issue
  // unrelated requests to account routes and cloud services.
  if (crypt) return <>{children}</>;

  if (role.status === 'loading') {
    return (
      <div className="shell" aria-busy="true">
        <p className="role-loading" role="status">Loading…</p>
      </div>
    );
  }

  const next = companionRedirect(pathname, role.mode);
  if (next) return <RoleRedirect href={next} />;

  return (
    <div className={role.mode === 'companion' ? 'shell companion-shell' : 'shell'}>
      {role.mode === 'companion' ? <CompanionNav /> : <AppNav />}
      <EngagementChrome mode={role.mode} />
      <div className="shell-main">{children}</div>
    </div>
  );
}
