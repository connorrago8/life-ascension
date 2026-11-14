'use client';

import { useRouter } from 'next/navigation';
import { ActivityLog } from '../../../components/companion/ActivityLog';

export default function LogPage() {
  const router = useRouter();
  return (
    <main className="wrap companion-page">
      <ActivityLog
        onLogged={() => router.push('/more/history')}
        onCancel={() => router.push('/')}
      />
    </main>
  );
}
