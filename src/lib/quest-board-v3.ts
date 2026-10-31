/**
 * Quest Board 3.0 — pure scheduling and selection engine.
 * Integration adapter: persistence, auth, AI, calendar and notifications belong to callers.
 * All timestamps are UTC ISO strings; gameplay days use America/Chicago, starting 05:00.
 */
export type Cadence = "daily" | "weekly" | "once";
export type QuestStatus = "active" | "completed" | "pending" | "ignored";
export type QuestSource = "manual" | "ai" | "calendar";
export interface Quest {
  id: string;
  title: string;
  cadence: Cadence;
  source: QuestSource;
  enabled: boolean;
  priority: number;
  createdAt: string;
  isNew?: boolean;
  category?: string;
  goalId?: string;
}
export interface Completion { questId: string; period: string; completedAt: string; source: "tap" | "chat" | "voice" | "integration"; }
export interface PendingInput { id: string; questId?: string; eventId?: string; question: string; createdAt: string; resolvedAt?: string; }
export interface WeeklyReview { questId: string; week: string; status: "completed" | "pending" | "ignored"; }
export interface Goal { id: string; title: string; milestoneIds: string[]; linkedQuestIds: string[]; rewardId?: string; }
export interface Reward { id: string; title: string; requirement: string; estimatedLabel: string; previewStats?: Record<string, number>; }
export interface CalendarSuggestion { eventId: string; title: string; startsAt: string; proposedQuest: string; }
export interface QuestBoardState {
  quests: Quest[];
  completions: Completion[];
  pendingInputs: PendingInput[];
  weeklyReviews: WeeklyReview[];
  goals: Goal[];
  rewards: Reward[];
  bonusRerolls: Record<string, number>;
}
const ZONE = "America/Chicago";
function parts(date: Date) {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  return Object.fromEntries(p.map(x => [x.type, x.value]));
}
function dayShift(ymd: string, delta: number): string {
  const d = new Date(ymd + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
/** 05:00 local boundary; works across DST transitions. */
export function questDay(now: Date): string {
  const p = parts(now);
  const ymd = `${p.year}-${p.month}-${p.day}`;
  return Number(p.hour) < 5 ? dayShift(ymd, -1) : ymd;
}
export function questWeek(now: Date): string {
  const day = questDay(now);
  const date = new Date(day + "T12:00:00Z");
  const mondayOffset = (date.getUTCDay() + 6) % 7;
  return dayShift(day, -mondayOffset);
}
export function periodFor(quest: Quest, now: Date): string {
  return quest.cadence === "daily" ? questDay(now) : quest.cadence === "weekly" ? questWeek(now) : "once";
}
export function isCompleted(quest: Quest, completions: Completion[], now: Date): boolean {
  const period = periodFor(quest, now);
  return completions.some(c => c.questId === quest.id && c.period === period);
}
/** Idempotent completion, including quests not shown on the board. Persist with UNIQUE(quest_id,period). */
export function completeQuest(state: QuestBoardState, questId: string, now: Date, source: Completion["source"]): { state: QuestBoardState; xpAwarded: 0 | 1 } {
  const quest = state.quests.find(q => q.id === questId && q.enabled);
  if (!quest) throw new Error("Unknown or disabled quest");
  if (isCompleted(quest, state.completions, now)) return { state, xpAwarded: 0 };
  const completion: Completion = { questId, period: periodFor(quest, now), completedAt: now.toISOString(), source };
  return { state: { ...state, completions: [...state.completions, completion] }, xpAwarded: 1 };
}
/** Daily quest count scales from five toward ten as pool grows to 25. */
export function dailyQuestCount(poolSize: number): number {
  return Math.max(0, Math.min(poolSize, Math.min(10, 5 + Math.floor(Math.max(0, poolSize - 5) / 4))));
}
function seededUnit(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967296;
}
function rank(quests: Quest[], seed: string): Quest[] {
  return [...quests].sort((a,b) => seededUnit(seed + ":" + a.id) - seededUnit(seed + ":" + b.id) || a.id.localeCompare(b.id));
}
/** Deterministic for the same day and pool; 3 random + 2 personalized at initial size 5. */
export function selectDailyQuests(quests: Quest[], now: Date): Quest[] {
  const pool = quests.filter(q => q.enabled && q.cadence === "daily");
  const count = dailyQuestCount(pool.length);
  const personalized = Math.round(count * 0.4);
  const random = count - personalized;
  const seed = questDay(now);
  const randomPicks = rank(pool, seed + ":random").slice(0, random);
  const picked = new Set(randomPicks.map(q => q.id));
  const personalPicks = pool.filter(q => !picked.has(q.id)).sort((a,b) => b.priority - a.priority || seededUnit(seed + a.id) - seededUnit(seed + b.id)).slice(0, personalized);
  return [...randomPicks, ...personalPicks];
}
/** All weekly quests are revealed by Wednesday 14:00 Chicago time. */
export function isWeeklyRevealed(quest: Quest, now: Date): boolean {
  if (quest.cadence !== "weekly") return true;
  const p = parts(now);
  const local = new Date(`${p.year}-${p.month}-${p.day}T12:00:00Z`);
  const weekday = local.getUTCDay(); // 1 Mon, 2 Tue, 3 Wed
  if (weekday > 3 || weekday === 0) return true;
  const minutesSinceMonday = (weekday - 1) * 1440 + Number(p.hour) * 60 + Number(p.minute);
  const windowMinutes = 2 * 1440 + 14 * 60;
  const revealMinute = Math.floor(seededUnit(questWeek(now) + ":weekly:" + quest.id) * windowMinutes);
  return minutesSinceMonday >= revealMinute;
}
export function bonusChoices(state: QuestBoardState, now: Date): Quest[] {
  const day = questDay(now);
  const daily = state.quests.filter(q => q.enabled && q.cadence === "daily");
  const displayed = selectDailyQuests(daily, now);
  if (!displayed.length || displayed.some(q => !isCompleted(q, state.completions, now))) return [];
  const used = state.bonusRerolls[day] || 0;
  const selected = new Set(displayed.map(q => q.id));
  return rank(daily.filter(q => !selected.has(q.id) && !isCompleted(q, state.completions, now)), day + ":bonus:" + used).slice(0, 3);
}
export function rerollBonus(state: QuestBoardState, now: Date): QuestBoardState {
  const day = questDay(now);
  if ((state.bonusRerolls[day] || 0) >= 1) throw new Error("Daily bonus reroll already used");
  if (!bonusChoices(state, now).length) throw new Error("Bonus quests not unlocked or unavailable");
  return { ...state, bonusRerolls: { ...state.bonusRerolls, [day]: 1 } };
}
/** Weekly review prompt: after Friday 17:00 or when an unresolved prior week exists. */
export function weeklyReviewDue(state: QuestBoardState, now: Date): Quest[] {
  const p = parts(now);
  const local = new Date(`${p.year}-${p.month}-${p.day}T12:00:00Z`);
  const week = questWeek(now);
  const fridayOrLater = local.getUTCDay() === 5 ? Number(p.hour) >= 17 : local.getUTCDay() === 6 || local.getUTCDay() === 0;
  return state.quests.filter(q => q.enabled && q.cadence === "weekly" && (fridayOrLater || state.weeklyReviews.some(r => r.questId === q.id && r.week !== week && r.status === "pending")) && !isCompleted(q, state.completions, now) && !state.weeklyReviews.some(r => r.questId === q.id && r.week === week && (r.status === "ignored" || r.status === "pending")));
}
/** Calendar events become suggestions, never mandatory quests, until reviewed. */
export function calendarPendingInputs(events: CalendarSuggestion[], existing: PendingInput[], now: Date): PendingInput[] {
  const seen = new Set(existing.map(i => i.eventId).filter(Boolean));
  return events.filter(e => !seen.has(e.eventId)).map(e => ({
    id: "calendar:" + e.eventId, eventId: e.eventId,
    question: `Add "${e.proposedQuest}" for "${e.title}" and choose a reminder?`,
    createdAt: now.toISOString()
  }));
}

/** The board can freeze daily picks for the whole gameplay day in persistent storage. */
export interface DailySelection { day: string; questIds: string[]; }
export function getOrCreateDailySelection(quests: Quest[], now: Date, existing?: DailySelection): DailySelection {
  const day = questDay(now);
  if (existing?.day === day) return existing;
  return { day, questIds: selectDailyQuests(quests, now).map(q => q.id) };
}
/** A streak counts consecutive completed cadence periods, not just visits to the board. */
export function individualStreak(quest: Quest, completions: Completion[], now: Date): number {
  if (quest.cadence === "once") return isCompleted(quest, completions, now) ? 1 : 0;
  const periods = new Set(completions.filter(c => c.questId === quest.id).map(c => c.period));
  let cursor = periodFor(quest, now);
  const step = quest.cadence === "weekly" ? -7 : -1;
  if (!periods.has(cursor)) cursor = dayShift(cursor, step);
  let streak = 0;
  while (periods.has(cursor)) { streak++; cursor = dayShift(cursor, step); }
  return streak;
}
/** Stable XP curve: existing levels are not rebalanced by Quest Board 3. */
export const LEVEL_XP = [0, 10, 25, 45, 70, 100, 135, 175, 220, 270] as const;
/** Quest management helpers preserve completion history and XP. */
export function archiveQuest(state: QuestBoardState, questId: string): QuestBoardState {
  return { ...state, quests: state.quests.map(q => q.id === questId ? { ...q, enabled: false } : q) };
}
export function updateQuest(state: QuestBoardState, questId: string, patch: Partial<Pick<Quest,"title"|"priority"|"category">>): QuestBoardState {
  if (patch.title !== undefined && (patch.title.trim().length < 1 || patch.title.length > 120)) throw new Error("Invalid quest title");
  return { ...state, quests: state.quests.map(q => q.id === questId ? { ...q, ...patch } : q) };
}
export function rewardPreview(reward: Reward, expanded: boolean): { label: string; stats?: Record<string, number> } {
  return expanded ? { label: reward.estimatedLabel, stats: reward.previewStats } : { label: reward.estimatedLabel };
}

/**
 * Resolve a weekly check-in against its ORIGINAL week, not the week of login.
 * This function never mutates XP; the authenticated database completion RPC
 * remains authoritative and must enforce exactly-once awards.
 */
export function resolveWeeklyReview(state: QuestBoardState, questId: string, week: string, status: WeeklyReview["status"]): QuestBoardState {
  const quest = state.quests.find(q => q.id === questId && q.cadence === "weekly" && q.enabled);
  if (!quest) throw new Error("Unknown weekly quest");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) throw new Error("Invalid week");
  const date = new Date(week + "T12:00:00Z");
  if (Number.isNaN(date.getTime()) || date.getUTCDay() !== 1 || date.toISOString().slice(0,10) !== week) throw new Error("Week must start Monday");
  const previous = state.weeklyReviews.filter(r => !(r.questId === questId && r.week === week));
  return { ...state, weeklyReviews: [...previous, { questId, week, status }] };
}
/** Keep the first accepted answer per suggestion; a dismissed card stays dismissed. */
export function resolvePendingInput(state: QuestBoardState, inputId: string, now: Date): QuestBoardState {
  return { ...state, pendingInputs: state.pendingInputs.map(i => i.id === inputId && !i.resolvedAt ? { ...i, resolvedAt: now.toISOString() } : i) };
}
/** Prevent automatic AI suggestions that repeat an existing habit title. */
export function isDuplicateQuestTitle(quests: Quest[], title: string): boolean {
  const normalize = (s: string) => s.normalize("NFKC").trim().replace(/\s+/g," ").toLocaleLowerCase("en-US");
  return quests.some(q => normalize(q.title) === normalize(title));
}
