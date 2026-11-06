/**
 * Pure, server-safe quest and companion accounting primitives.
 * Persistence/authorization must be enforced by the calling service.
 * Never accept client-supplied XP totals as authoritative.
 */
export type QuestCredit = {
  id: string;
  actor: "connor" | "izzy";
  questKey: string;
  localDate: string; // YYYY-MM-DD, America/Chicago
  source: "personal" | "izzy-submission";
  completed: boolean;
};

export function chicagoDate(instant: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(instant);
}

export function questDayKey(actor: QuestCredit["actor"], questKey: string, localDate: string): string {
  calendarDate(localDate);
  if (!questKey.trim()) throw new Error("Missing quest key");
  return [actor, localDate, questKey.trim().toLowerCase()].join(":");
}

/** One credit per actor/quest/day. Izzy submission upgrades an overlap to 2 total XP. */
export function awardCredits(records: readonly QuestCredit[]): { total: Record<QuestCredit["actor"], number>; byQuestDay: Record<string, number> } {
  const byQuestDay: Record<string, number> = Object.create(null);
  for (const record of records) {
    if (!record.completed) continue;
    const key = questDayKey(record.actor, record.questKey, record.localDate);
    const value = record.source === "izzy-submission" ? 2 : 1;
    byQuestDay[key] = Math.max(byQuestDay[key] ?? 0, value);
  }
  const total = { connor: 0, izzy: 0 };
  for (const [key, amount] of Object.entries(byQuestDay)) {
    const actor = key.split(":")[0] as QuestCredit["actor"];
    total[actor] += amount;
  }
  return { total, byQuestDay };
}

/** Reject both malformed dates and JavaScript's automatic calendar rollover. */
function calendarDate(localDate: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate)) throw new Error("Invalid local date");
  const date = new Date(localDate + "T12:00:00Z");
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== localDate) throw new Error("Invalid local date");
  return date;
}

/** ISO Monday-start week for date-only values; independent of server timezone. */
export function weekStart(localDate: string): string {
  const date = calendarDate(localDate);
  const offset = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString().slice(0, 10);
}

export function weeklyCompanionXp(records: readonly QuestCredit[], localDate: string): number {
  const week = weekStart(localDate);
  const relevant = records.filter(r => r.actor === "izzy" && weekStart(r.localDate) === week);
  return awardCredits(relevant).total.izzy;
}
