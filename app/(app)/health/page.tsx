'use client';

import { HealthPanel } from '../../../components/ascension/HealthPanel';
import { TrackTemplates } from '../../../components/ascension/TrackTemplates';
import { CategoryBoard } from '../../../components/ascension/CategoryBoard';

export default function HealthPage() {
  return (
    <main className="wrap">
      <HealthPanel />
      <TrackTemplates track="health" />
      <CategoryBoard only="health" limit={null} />
    </main>
  );
}
