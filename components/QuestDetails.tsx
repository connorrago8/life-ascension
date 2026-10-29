'use client';
import { questDetailFacts } from '../lib/preview/questDetailFacts.mjs';

type Quest = {
  title: string;
  domain: string;
  cadence: 'once' | 'daily';
  quest_type: 'scheduled' | 'goal';
  target_amount: number | null;
  progress_increment: number | null;
  progress_unit: string | null;
};
type Instance = {
  due_date: string;
  status: 'available' | 'completed' | 'deferred';
  current_amount: number;
};

export function QuestDetails({ quest, instance }: {quest: Quest; instance: Instance}) {
  const facts = questDetailFacts(quest, instance);
  return (
    <details className="quest-card-details">
      <summary aria-label={`Quest details for ${quest.title}`}>Quest details</summary>
      <dl>
        {facts.map(fact => (
          <div key={fact.label}>
            <dt>{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
