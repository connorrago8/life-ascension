/** Deterministic "Just type" splitter. The server uses this when the AI Gateway is unavailable. */

export type QuestCadence = 'daily' | 'weekly';

export type QuestDraft = {
  title: string;
  note: string;
  cadence: QuestCadence;
};

const MAX_INPUT = 1000;
const MAX_ITEMS = 10;
const MAX_TITLE = 120;
const MAX_NOTE = 500;

const WEEKLY_RULES: readonly { pattern: RegExp; title: string }[] = [
  { pattern: /cardboard|\bbox(?:es)?\b/i, title: 'Get rid of the cardboard boxes' },
  { pattern: /deep clean/i, title: 'Deep clean' },
  { pattern: /errands?/i, title: 'Run errands' },
  { pattern: /this week|sometime this week/i, title: '' },
];

const DAILY_RULES: readonly { pattern: RegExp; title: string }[] = [
  { pattern: /clothes|cloth/i, title: 'Fold and put away clothes on the floor' },
  { pattern: /laundry/i, title: 'Put away laundry' },
  { pattern: /dishwasher/i, title: 'Unload the dishwasher' },
  { pattern: /trash|garbage/i, title: 'Take out the trash' },
  { pattern: /outfit/i, title: 'Pick out an outfit' },
  { pattern: /tidy/i, title: 'Tidy up' },
];

export function splitClauses(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((clause) => clause.trim())
    .filter((clause) => clause.length > 0);
}

function plain(value: string, max: number): string {
  return value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function cleanedTitle(clause: string): string {
  const stripped = clause
    .replace(/^(ok so|hey|just|please|can you|could you|do you have|when are you gonna)\s+/i, '')
    .replace(/[?.!]+$/g, '')
    .trim();
  if (!stripped) return '';
  return stripped.charAt(0).toUpperCase() + stripped.slice(1);
}

function classifyClause(clause: string): QuestDraft | null {
  const note = plain(clause, MAX_NOTE);
  if (!note) return null;
  for (const rule of WEEKLY_RULES) {
    if (!rule.pattern.test(clause)) continue;
    const title = plain(rule.title || cleanedTitle(clause), MAX_TITLE);
    if (!title) return null;
    return { title, note, cadence: 'weekly' };
  }
  for (const rule of DAILY_RULES) {
    if (!rule.pattern.test(clause)) continue;
    return { title: plain(rule.title, MAX_TITLE), note, cadence: 'daily' };
  }
  const title = plain(cleanedTitle(clause), MAX_TITLE);
  if (!title) return null;
  return { title, note, cadence: 'daily' };
}

/** Split free text into at most 10 quest drafts. Quick chores default to daily. */
export function fallbackQuestDrafts(text: string): QuestDraft[] {
  const source = plain(text, MAX_INPUT);
  const drafts: QuestDraft[] = [];
  const seen = new Set<string>();
  for (const clause of splitClauses(source)) {
    const draft = classifyClause(clause);
    if (!draft) continue;
    const key = draft.title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    drafts.push(draft);
    if (drafts.length >= MAX_ITEMS) break;
  }
  return drafts;
}

export function sanitizeQuestDrafts(value: unknown): QuestDraft[] {
  if (!Array.isArray(value)) return [];
  const drafts: QuestDraft[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const title = typeof row.title === 'string' ? plain(row.title, MAX_TITLE) : '';
    const note = typeof row.note === 'string' ? plain(row.note, MAX_NOTE) : '';
    const cadence = row.cadence === 'weekly' ? 'weekly' : row.cadence === 'daily' ? 'daily' : null;
    if (!title || !cadence) continue;
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    drafts.push({ title, note, cadence });
    if (drafts.length >= MAX_ITEMS) break;
  }
  return drafts;
}
