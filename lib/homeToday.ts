/**
 * Read-only "Today" glance for the Home screen. Counts what is left and done
 * today without creating instances (the Quests board owns ensure/complete).
 */
export type GlanceQuest = { id: string; cadence: string | null; quest_type: string | null; scheduled_for: string | null };
export type GlanceInstance = { quest_id: string; due_date: string; status: string };
export type TodayGlance = { left: number; done: number };

export function chicagoToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function todayGlance(quests: readonly GlanceQuest[], instances: readonly GlanceInstance[], today: string): TodayGlance {
  let left = 0;
  let done = 0;
  for (const quest of quests) {
    const mine = instances.filter((instance) => instance.quest_id === quest.id);
    if (quest.cadence === 'daily' && quest.quest_type !== 'goal') {
      if (quest.scheduled_for && quest.scheduled_for > today) continue;
      const todays = mine.find((instance) => instance.due_date === today);
      if (todays?.status === 'completed') done += 1;
      else if (!todays || todays.status === 'available') left += 1;
      continue;
    }
    for (const instance of mine) {
      if (instance.status === 'completed') { if (instance.due_date === today) done += 1; continue; }
      if (instance.status === 'available' && instance.due_date <= today) left += 1;
    }
  }
  return { left, done };
}

export function todayGlanceLabel(glance: TodayGlance): string {
  if (glance.left === 0 && glance.done === 0) return 'No quests due today';
  if (glance.left === 0) return `All done · ${glance.done} completed`;
  return `${glance.left} left · ${glance.done} done`;
}
