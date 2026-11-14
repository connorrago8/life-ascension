export type CoupleQuestView = {
  id: string;
  title: string;
  description: string | null;
  cadence: string;
  dueAt: string | null;
  myDone: boolean;
  partnerDone: boolean;
  awarded: boolean;
};

export type CoupleBucket = 'today' | 'week' | 'upcoming' | 'completed';

export function parseCoupleQuest(value: unknown): CoupleQuestView | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== 'string' || typeof row.title !== 'string') return null;
  return {
    id: row.id,
    title: row.title,
    description: typeof row.description === 'string' ? row.description : null,
    cadence: typeof row.cadence === 'string' ? row.cadence : 'weekly',
    dueAt: typeof row.dueAt === 'string' ? row.dueAt : null,
    myDone: row.myDone === true,
    partnerDone: row.partnerDone === true,
    awarded: row.awarded === true,
  };
}

/** Each person's own mark decides their row. A partner's unfinished part does not keep yours open. */
export function coupleBucket(quest: CoupleQuestView, today: string, weekEnd: string): CoupleBucket {
  if (quest.myDone) return 'completed';
  if (quest.dueAt) {
    const day = quest.dueAt.slice(0, 10);
    if (day <= today) return 'today';
    if (day <= weekEnd) return 'week';
    return 'upcoming';
  }
  if (quest.cadence === 'weekly' || quest.cadence === 'monthly') return 'week';
  return 'today';
}

export function coupleMarkMessage(result: unknown): string {
  const row = result && typeof result === 'object' ? result as { awarded?: boolean; already?: boolean } : {};
  if (row.awarded) return 'Both parts are done. XP stays on each account.';
  if (row.already) return 'Already recorded for this period.';
  return 'Your part is marked. Their part stays separate.';
}
