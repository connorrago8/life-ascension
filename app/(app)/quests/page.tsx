import { Suspense } from 'react';
import { CategoryBoard } from '../../../components/ascension/CategoryBoard';
import { QuestScheduleBanner } from '../../../components/ascension/QuestScheduleBanner';

export default function QuestsPage() {
  return (
    <Suspense fallback={<main className="wrap"><p role="status">Loading quests…</p></main>}>
      <main className="wrap">
        <QuestScheduleBanner />
        <CategoryBoard />
      </main>
    </Suspense>
  );
}
