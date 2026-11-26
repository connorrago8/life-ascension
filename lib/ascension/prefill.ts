const DOMAINS = new Set([
  'hygiene', 'home', 'mental_health', 'personal_growth', 'finance', 'career', 'relationships', 'physical_health',
]);

export type QuestPrefill = {
  title: string;
  domain: string;
  cadence: 'once' | 'daily' | 'weekly';
  date: string;
};

export function parseQuestPrefill(params: URLSearchParams, today: string): QuestPrefill | null {
  const title = params.get('quest')?.trim() ?? '';
  if (!title || title.length > 120) return null;
  const domain = params.get('domain') ?? '';
  const cadence = params.get('cadence');
  const date = params.get('date') ?? '';
  return {
    title,
    domain: DOMAINS.has(domain) ? domain : 'personal_growth',
    cadence: cadence === 'daily' || cadence === 'weekly' || cadence === 'once' ? cadence : 'once',
    date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : today,
  };
}

export const SCHEDULE_QUEST_LABEL = 'Schedule quest';
