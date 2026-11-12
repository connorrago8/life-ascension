'use client';

import { useRouter } from 'next/navigation';
import { ActivityLog } from '../../../../components/companion/ActivityLog';

export default function CompanionLogPage() {
  const router = useRouter();
  return (
    <main className="wrap companion-page">
      <ActivityLog
        onLogged={() => router.push('/companion/history')}
        onCancel={() => router.push('/companion/home')}
      />
    </main>
  );
}
