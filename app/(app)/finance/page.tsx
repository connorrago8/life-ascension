'use client';

import { CategoryBoard } from '../../../components/ascension/CategoryBoard';
import { FinancePanel } from '../../../components/ascension/FinancePanel';

export default function FinancePage() {
  return (
    <main className="wrap">
      <FinancePanel />
      <CategoryBoard only="finance" limit={null} />
    </main>
  );
}
