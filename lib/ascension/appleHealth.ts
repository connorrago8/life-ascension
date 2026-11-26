import {
  LIGHTS_OUT_DEADLINE,
  LIGHTS_OUT_NIGHT_START,
  NUTRITION_MAX_GRAMS,
  NUTRITION_MAX_KCAL,
} from './config.ts';
import { shiftDate } from './dates.ts';
import { healthGameDay, healthNightAllowed } from './lightsOut.ts';
import { GAME_DAY_START_MINUTES, QUEST_TIME_ZONE, localParts } from '../questStreak.ts';

export const APPLE_HEALTH_SOURCE = 'apple_health';
export const LIGHTS_OUT_RECEIPT = 'Auto from Apple Health';
export const HEALTH_INGEST_HOURLY_LIMIT = 30;
export const HEALTH_INGEST_MAX_BODY_BYTES = 16_384;
export const HEALTH_INGEST_MAX_SAMPLES = 64;
const MAX_SLEEP_MS = 20 * 60 * 60 * 1000;
const SOURCE_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 .()+&-]{0,39}$/;
const ISO_OFFSET = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IGNORED_STAGE = /^(in[\s_-]?bed|awake|hkcategoryvaluesleepanalysisinbed|hkcategoryvaluesleepanalysisawake)$/i;
const TOKEN_PATTERN = /^la_sleep_[A-Za-z0-9_-]{43}$/;

export function lightsOutReceipt(sourceName: string | null | undefined): string {
  if (!sourceName) return LIGHTS_OUT_RECEIPT;
  return `${LIGHTS_OUT_RECEIPT} (${sourceName})`;
}

export function isIngestToken(token: string): boolean {
  return TOKEN_PATTERN.test(token);
}

/** Wall-clock time on a Chicago calendar date, including across DST. */
export function chicagoWallTime(date: string, hour: number, minute: number): Date {
  const utcGuess = Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)), hour, minute, 0);
  const local = localParts(new Date(utcGuess), QUEST_TIME_ZONE);
  const got = Date.UTC(
    Number(local.date.slice(0, 4)),
    Number(local.date.slice(5, 7)) - 1,
    Number(local.date.slice(8, 10)),
    Math.floor(local.minutes / 60),
    local.minutes % 60,
  );
  const desired = Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)), hour, minute, 0);
  return new Date(utcGuess - (got - desired));
}

function clock(value: string): { hour: number; minute: number } {
  const [hour, minute] = value.split(':').map(Number);
  return { hour, minute };
}

/** Game day for nutrition and sleep. Same 5:00 AM America/Chicago boundary as quests. */
export function nutritionGameDay(instant: Date): string {
  return healthGameDay(instant, QUEST_TIME_ZONE);
}

export type SleepDecision = {
  gameDay: string;
  inNight: boolean;
  credit: boolean;
};

/**
 * The night runs from LIGHTS_OUT_NIGHT_START through the 5:00 AM game-day
 * boundary. Credit requires a start inside that night at or before
 * LIGHTS_OUT_DEADLINE. 5:00 AM is the next game day and is not a bedtime.
 */
export function sleepDecision(start: Date): SleepDecision {
  const gameDay = nutritionGameDay(start);
  const openClock = clock(LIGHTS_OUT_NIGHT_START);
  const deadlineClock = clock(LIGHTS_OUT_DEADLINE);
  const open = chicagoWallTime(gameDay, openClock.hour, openClock.minute);
  const deadline = chicagoWallTime(gameDay, deadlineClock.hour, deadlineClock.minute);
  const close = chicagoWallTime(shiftDate(gameDay, 1), Math.floor(GAME_DAY_START_MINUTES / 60), GAME_DAY_START_MINUTES % 60);
  const inNight = start.getTime() >= open.getTime() && start.getTime() < close.getTime();
  return { gameDay, inNight, credit: inNight && start.getTime() <= deadline.getTime() };
}

export function cleanSourceName(value: unknown): { ok: true; name: string | null } | { ok: false; error: string } {
  if (value === undefined || value === null || value === '') return { ok: true, name: null };
  if (typeof value !== 'string') return { ok: false, error: 'source_name must be text' };
  const name = value.trim().replace(/\s+/g, ' ');
  if (!SOURCE_NAME_PATTERN.test(name)) return { ok: false, error: 'source_name must be 1 to 40 letters, numbers, or simple punctuation' };
  return { ok: true, name };
}

export function isIgnoredSleepStage(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const label = value.trim();
  if (!label) return false;
  return IGNORED_STAGE.test(label);
}

function parseOffsetTimestamp(value: unknown, label: string): { ok: true; date: Date } | { ok: false; error: string } {
  if (typeof value !== 'string' || !ISO_OFFSET.test(value.trim())) {
    return { ok: false, error: `${label} must be an ISO-8601 time with a timezone offset` };
  }
  const date = new Date(value.trim());
  if (Number.isNaN(date.getTime())) return { ok: false, error: `${label} is not a real time` };
  return { ok: true, date };
}

function calendarDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

export type SampleChoice = {
  start: Date;
  end: Date;
  gameDay: string;
  credit: boolean;
  inNight: boolean;
  sourceName: string | null;
};

/** Earliest asleep start on the latest night in the payload. In-bed and awake samples are dropped. */
export function chooseSleepSamples(samples: readonly Record<string, unknown>[]): { ok: true; value: SampleChoice | null } | { ok: false; error: string } {
  if (samples.length > HEALTH_INGEST_MAX_SAMPLES) return { ok: false, error: `Send at most ${HEALTH_INGEST_MAX_SAMPLES} sleep samples` };
  const asleep: { start: Date; end: Date; sourceName: string | null; decision: SleepDecision }[] = [];
  for (const sample of samples) {
    const stage = sample.value ?? sample.stage ?? sample.label;
    if (isIgnoredSleepStage(stage)) continue;
    const start = parseOffsetTimestamp(sample.start, 'sample start');
    if (!start.ok) return start;
    const end = parseOffsetTimestamp(sample.end, 'sample end');
    if (!end.ok) return end;
    if (end.date.getTime() <= start.date.getTime()) return { ok: false, error: 'sample end must be after sample start' };
    const sourceName = cleanSourceName(sample.source_name);
    if (!sourceName.ok) return sourceName;
    asleep.push({ start: start.date, end: end.date, sourceName: sourceName.name, decision: sleepDecision(start.date) });
  }
  const inNight = asleep.filter((sample) => sample.decision.inNight);
  if (inNight.length === 0) return { ok: true, value: null };
  const gameDay = inNight.map((sample) => sample.decision.gameDay).sort().at(-1) ?? inNight[0].decision.gameDay;
  const night = inNight.filter((sample) => sample.decision.gameDay === gameDay);
  const earliest = night.reduce((best, sample) => (sample.start.getTime() < best.start.getTime() ? sample : best));
  const end = night.reduce((latest, sample) => (sample.end.getTime() > latest ? sample.end.getTime() : latest), earliest.end.getTime());
  if (end - earliest.start.getTime() > MAX_SLEEP_MS) return { ok: false, error: 'Sleep interval is too long' };
  return {
    ok: true,
    value: {
      start: earliest.start,
      end: new Date(end),
      gameDay,
      credit: earliest.decision.credit,
      inNight: true,
      sourceName: earliest.sourceName,
    },
  };
}

export type ResolvedSleep = SampleChoice;

function sleepFromBounds(startRaw: unknown, endRaw: unknown, sourceName: string | null): { ok: true; value: ResolvedSleep } | { ok: false; error: string } {
  const start = parseOffsetTimestamp(startRaw, 'sleep_start');
  if (!start.ok) return start;
  const end = parseOffsetTimestamp(endRaw, 'sleep_end');
  if (!end.ok) return end;
  if (end.date.getTime() <= start.date.getTime()) return { ok: false, error: 'sleep_end must be after sleep_start' };
  if (end.date.getTime() - start.date.getTime() > MAX_SLEEP_MS) return { ok: false, error: 'Sleep interval is too long' };
  const decision = sleepDecision(start.date);
  return {
    ok: true,
    value: { start: start.date, end: end.date, gameDay: decision.gameDay, credit: decision.credit, inNight: decision.inNight, sourceName },
  };
}

export type NutritionBasis = 'diary_date' | 'game_window';
export type NutritionReadStatus = 'complete' | 'partial' | 'failed';

/** Shadow import. Fiber and water are accepted by the parser and then discarded. */
export type NutritionInput = {
  gameDay: string;
  observedAt: Date;
  basis: NutritionBasis;
  readStatus: NutritionReadStatus;
  energyKcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
};

export type StoredNutrition = {
  gameDay: string;
  observedAt: string;
  basis: NutritionBasis;
  readStatus: NutritionReadStatus;
  energyKcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  requestId: string;
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function nutrient(value: unknown, label: string, max: number): { ok: true; value: number | null } | { ok: false; error: string } {
  if (value === undefined || value === null) return { ok: true, value: null };
  if (typeof value !== 'number' || !Number.isFinite(value)) return { ok: false, error: `${label} must be a finite number of ${label.endsWith('kcal') ? 'kcal' : 'grams'}` };
  if (value < 0 || value > max) return { ok: false, error: `${label} must be from 0 to ${max}` };
  return { ok: true, value: round2(value) };
}

export function parseNutrition(body: unknown): { ok: true; value: NutritionInput } | { ok: false; error: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'Body must be a JSON object' };
  const record = body as Record<string, unknown>;
  if (record.schema_version !== 1) return { ok: false, error: 'schema_version must be 1' };
  if (record.timezone !== 'America/Chicago') return { ok: false, error: 'timezone must be America/Chicago' };
  if (record.basis !== 'diary_date' && record.basis !== 'game_window') return { ok: false, error: 'basis must be diary_date or game_window' };
  if (record.source !== 'cronometer') return { ok: false, error: 'source must be cronometer' };
  if (record.read_status !== 'complete' && record.read_status !== 'partial' && record.read_status !== 'failed') {
    return { ok: false, error: 'read_status must be complete, partial, or failed' };
  }
  if (typeof record.game_date !== 'string' || !calendarDate(record.game_date.trim())) return { ok: false, error: 'game_date must be YYYY-MM-DD' };
  if (typeof record.request_id !== 'string' || !UUID_PATTERN.test(record.request_id)) return { ok: false, error: 'request_id must be a UUID' };
  const observed = parseOffsetTimestamp(record.observed_at, 'observed_at');
  if (!observed.ok) return observed;

  const energyField = record.energy_kcal !== undefined ? record.energy_kcal : record.dietary_energy_kcal;
  if (record.energy_kcal !== undefined && record.dietary_energy_kcal !== undefined && record.energy_kcal !== record.dietary_energy_kcal) {
    return { ok: false, error: 'energy_kcal and dietary_energy_kcal disagree' };
  }
  const failed = record.read_status === 'failed';
  const energy = failed ? { ok: true as const, value: null } : nutrient(energyField, 'energy_kcal', NUTRITION_MAX_KCAL);
  if (!energy.ok) return energy;
  const protein = failed ? { ok: true as const, value: null } : nutrient(record.protein_g, 'protein_g', NUTRITION_MAX_GRAMS);
  if (!protein.ok) return protein;
  const carbs = failed ? { ok: true as const, value: null } : nutrient(record.carbs_g, 'carbs_g', NUTRITION_MAX_GRAMS);
  if (!carbs.ok) return carbs;
  const fat = failed ? { ok: true as const, value: null } : nutrient(record.fat_g, 'fat_g', NUTRITION_MAX_GRAMS);
  if (!fat.ok) return fat;

  return {
    ok: true,
    value: {
      gameDay: record.game_date.trim(),
      observedAt: observed.date,
      basis: record.basis,
      readStatus: record.read_status,
      energyKcal: energy.value,
      proteinG: protein.value,
      carbsG: carbs.value,
      fatG: fat.value,
    },
  };
}

export type HealthIngestBody = {
  requestId: string;
  sleep: ResolvedSleep | null;
  /** True when the body included a sleep interval or samples, even if none counted. */
  sleepAttempted: boolean;
};

export function parseHealthIngest(body: unknown, _now: Date): { ok: true; value: HealthIngestBody } | { ok: false; error: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'Body must be a JSON object' };
  const record = body as Record<string, unknown>;
  if (typeof record.request_id !== 'string' || !UUID_PATTERN.test(record.request_id)) {
    return { ok: false, error: 'request_id must be a UUID' };
  }
  if (record.source !== undefined && record.source !== APPLE_HEALTH_SOURCE) {
    return { ok: false, error: 'source must be apple_health' };
  }

  let sleep: ResolvedSleep | null = null;
  const samples = record.samples;
  const hasSamples = Array.isArray(samples) && samples.length > 0;
  const hasBounds = record.sleep_start !== undefined || record.sleep_end !== undefined;
  if (Array.isArray(samples) && samples.length > 0) {
    if (!samples.every((sample) => sample && typeof sample === 'object' && !Array.isArray(sample))) {
      return { ok: false, error: 'samples must be objects' };
    }
    const chosen = chooseSleepSamples(samples as Record<string, unknown>[]);
    if (!chosen.ok) return chosen;
    // Samples are authoritative. In-bed and awake rows do not fall back to sleep_start.
    sleep = chosen.value;
  } else if (hasBounds) {
    const parsed = sleepFromBounds(record.sleep_start, record.sleep_end, null);
    if (!parsed.ok) return parsed;
    sleep = parsed.value;
  }
  const sleepAttempted = hasSamples || hasBounds;
  if (sleepAttempted && record.source !== APPLE_HEALTH_SOURCE) {
    return { ok: false, error: 'source must be apple_health' };
  }
  if (!sleepAttempted) return { ok: false, error: 'Send a sleep interval' };
  return { ok: true, value: { requestId: record.request_id.toLowerCase(), sleep, sleepAttempted } };
}

export function ingestWindowAllows(gameDay: string, today: string): boolean {
  return healthNightAllowed(gameDay, today);
}

export type SleepRow = { gameDay: string; requestId: string; xp: number; credited: boolean; sourceName: string | null };
export type LightsOutRow = { gameDay: string; requestId: string; xp: number };

export function applyAutoSleep(
  sleepRows: readonly SleepRow[],
  lightsOut: readonly LightsOutRow[],
  sleep: ResolvedSleep,
  requestId: string,
  today: string,
  award: (rows: readonly LightsOutRow[], gameDay: string, requestId: string) => { rows: LightsOutRow[]; already: boolean; xpAwarded: number },
): { sleepRows: SleepRow[]; lightsOut: LightsOutRow[]; xpAwarded: number; already: boolean; status: 'ok' | 'rejected' } {
  if (!ingestWindowAllows(sleep.gameDay, today)) {
    return { sleepRows: [...sleepRows], lightsOut: [...lightsOut], xpAwarded: 0, already: false, status: 'rejected' };
  }
  if (sleepRows.some((row) => row.requestId === requestId)) {
    return { sleepRows: [...sleepRows], lightsOut: [...lightsOut], xpAwarded: 0, already: true, status: 'ok' };
  }
  if (!sleep.inNight) {
    return { sleepRows: [...sleepRows], lightsOut: [...lightsOut], xpAwarded: 0, already: false, status: 'ok' };
  }
  if (sleepRows.some((row) => row.gameDay === sleep.gameDay)) {
    return { sleepRows: [...sleepRows], lightsOut: [...lightsOut], xpAwarded: 0, already: true, status: 'ok' };
  }
  if (!sleep.credit) {
    return {
      sleepRows: [...sleepRows, { gameDay: sleep.gameDay, requestId, xp: 0, credited: false, sourceName: sleep.sourceName }],
      lightsOut: [...lightsOut],
      xpAwarded: 0,
      already: false,
      status: 'ok',
    };
  }
  const claimed = award(lightsOut, sleep.gameDay, requestId);
  const credited = !claimed.already;
  return {
    sleepRows: [...sleepRows, { gameDay: sleep.gameDay, requestId, xp: claimed.xpAwarded, credited, sourceName: sleep.sourceName }],
    lightsOut: claimed.rows,
    xpAwarded: claimed.xpAwarded,
    already: claimed.already,
    status: 'ok',
  };
}

function keep(incoming: number | null, previous: number | null, failed: boolean): number | null {
  if (failed || incoming === null) return previous;
  return incoming;
}

/** Newer observation wins. Null does not erase a stored number. Zero does. Failed reads store no totals. */
export function applyNutrition(
  days: ReadonlyMap<string, StoredNutrition>,
  requests: ReadonlySet<string>,
  input: NutritionInput,
  requestId: string,
  today: string,
): { days: Map<string, StoredNutrition>; requests: Set<string>; status: 'ok' | 'stale' | 'duplicate_request_id' | 'rejected'; xpAwarded: 0 } {
  if (requests.has(requestId)) {
    return { days: new Map(days), requests: new Set(requests), status: 'duplicate_request_id', xpAwarded: 0 };
  }
  if (!ingestWindowAllows(input.gameDay, today)) {
    return { days: new Map(days), requests: new Set(requests), status: 'rejected', xpAwarded: 0 };
  }
  const nextRequests = new Set(requests);
  nextRequests.add(requestId);
  const existing = days.get(input.gameDay);
  if (existing && input.observedAt.getTime() < Date.parse(existing.observedAt)) {
    return { days: new Map(days), requests: nextRequests, status: 'stale', xpAwarded: 0 };
  }
  const failed = input.readStatus === 'failed';
  const nextDays = new Map(days);
  nextDays.set(input.gameDay, {
    gameDay: input.gameDay,
    observedAt: input.observedAt.toISOString(),
    basis: input.basis,
    readStatus: input.readStatus,
    requestId,
    energyKcal: keep(input.energyKcal, existing?.energyKcal ?? null, failed),
    proteinG: keep(input.proteinG, existing?.proteinG ?? null, failed),
    carbsG: keep(input.carbsG, existing?.carbsG ?? null, failed),
    fatG: keep(input.fatG, existing?.fatG ?? null, failed),
  });
  return { days: nextDays, requests: nextRequests, status: 'ok', xpAwarded: 0 };
}
