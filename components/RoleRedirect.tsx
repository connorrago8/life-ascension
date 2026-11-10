'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function RoleRedirect({ href }: { href: string }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(href);
  }, [href, router]);
  return <p className="role-loading" role="status">Loading…</p>;
}
