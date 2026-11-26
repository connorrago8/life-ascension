'use client';

import { CategoryBoard } from '../../../components/ascension/CategoryBoard';
import { FinancePanel } from '../../../components/ascension/FinancePanel';
import { TrackTemplates } from '../../../components/ascension/TrackTemplates';

export default function FinancePage() {
  return (
    <main className="wrap">
      <FinancePanel />
      <TrackTemplates track="finance" />
      <CategoryBoard only="finance" limit={null} />
    </main>
  );
}
