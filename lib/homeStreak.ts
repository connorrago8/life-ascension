import { parseStreak } from './questStreak.ts';

/**
 * Home's today card summarizes per-quest streaks from get_quest_streaks,
 * the same rows the quest board turns into "🔥 N days" badges. It counts
 * quests whose current streak is at least 1. It is not an account-wide
 * day counter, and it does not change XP.
 */
export function countQuestsOnStreak(
  rows: unknown,
  quests: readonly { id: string; cadence: string | null }[],
): number | null {
  if (!Array.isArray(rows)) return null;
  const daily = new Set(quests.filter((quest) => quest.cadence === 'daily' && quest.id).map((quest) => quest.id));
  const seen = new Set<string>();
  let count = 0;
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const id = (row as { quest_id?: unknown }).quest_id;
    if (typeof id !== 'string' || !daily.has(id) || seen.has(id)) continue;
    seen.add(id);
    const parsed = parseStreak(row);
    if (parsed && parsed.fire >= 1) count += 1;
  }
  return count;
}

/** "🔥 1 quest on a streak" or "🔥 N quests on a streak". Hidden at zero. */
export function homeStreakLabel(count: number | null | undefined): string | null {
  if (typeof count !== 'number' || !Number.isSafeInteger(count) || count <= 0) return null;
  return count === 1 ? '🔥 1 quest on a streak' : `🔥 ${count} quests on a streak`;
}

/** Cache reads only the per-quest count. An older day-counter payload stays hidden. */
export function cachedQuestStreakCount(streak: unknown): number | null {
  if (!streak || typeof streak !== 'object') return null;
  const count = (streak as { questsOnStreak?: unknown }).questsOnStreak;
  if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0) return null;
  return count;
}
