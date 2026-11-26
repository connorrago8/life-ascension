'use client';

import { CategoryBoard } from '../../../components/ascension/CategoryBoard';
import { FinanceImport } from '../../../components/ascension/FinanceImport';
import { FinancePanel } from '../../../components/ascension/FinancePanel';
import { TrackTemplates } from '../../../components/ascension/TrackTemplates';

export default function FinancePage() {
  return (
    <main className="wrap">
      <FinancePanel />
      <FinanceImport />
      <TrackTemplates track="finance" />
      <CategoryBoard only="finance" limit={null} />
    </main>
  );
}
