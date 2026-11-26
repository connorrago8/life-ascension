'use client';

import { HealthPanel } from '../../../components/ascension/HealthPanel';
import { CategoryBoard } from '../../../components/ascension/CategoryBoard';

export default function HealthPage() {
  return (
    <main className="wrap">
      <HealthPanel />
      <CategoryBoard only="health" limit={null} />
    </main>
  );
}
