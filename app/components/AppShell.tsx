'use client';

import { Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { companionRedirect } from '../../lib/companionAccess';
import { EngagementChrome } from '../../components/EngagementChrome';
import { StatusPill } from '../../components/StatusPill';
import { AppNav } from './AppNav';
import { RoleRedirect } from '../../components/RoleRedirect';
import { useCompanionRole } from '../../components/useCompanionRole';

function AppShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/';
  const search = useSearchParams();
  const crypt = pathname === '/play/crypt' || pathname.startsWith('/play/crypt/');
  const role = useCompanionRole(!crypt);

  if (crypt) return <>{children}</>;

  if (role.status === 'loading') {
    return (
      <div className="shell" aria-busy="true">
        <p className="role-loading" role="status">Loading…</p>
      </div>
    );
  }

  const next = companionRedirect(pathname, role.mode, search.toString());
  if (next) return <RoleRedirect href={next} />;

  return (
    <div className={role.mode === 'companion' ? 'shell companion-shell' : 'shell'}>
      <AppNav />
      <div className="nav-status-slot" data-slot="engagement-status">
        {role.mode !== 'signed-out' && <StatusPill mode={role.mode === 'companion' ? 'companion' : 'adventurer'} />}
      </div>
      <EngagementChrome mode={role.mode} showPill={false} />
      <div className="shell-main">{children}</div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="shell" aria-busy="true"><p className="role-loading" role="status">Loading…</p></div>}>
      <AppShellInner>{children}</AppShellInner>
    </Suspense>
  );
}
