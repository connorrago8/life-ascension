/**
 * POST /api/wellness core: validation and request handling, with the auth check and the
 * database write injected so the route stays thin and this file stays testable.
 * Never logs or echoes the Authorization header or the API key.
 */

export const WELLNESS_LIMITS = {
  maxSleepHours: 24,
  maxSteps: 200000,
  pastDays: 30,
  futureDays: 1,
  maxBodyBytes: 4096,
} as const;
export const WELLNESS_DEFAULT_SOURCE = 'apple_health_shortcut';
const SOURCE_PATTERN = /^[a-z0-9_]{1,40}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const REALM = 'Bearer realm="life-ascension"';

export type WellnessInput = { date: string; sleepHours: number | null; steps: number | null; source: string };
export type WellnessReading = { date: string; sleep_hours: number | null; steps: number | null; source: string; updated_at: string | null };

type AuthOk = { ok: true; userId: string; method: 'api_key' | 'supabase_jwt'; scopes: string[] };
type AuthFail = { ok: false; status: 401 | 503; error: string };

export type WellnessDeps = {
  authenticate: (req: Request) => Promise<AuthOk | AuthFail>;
  record: (auth: AuthOk, input: WellnessInput) => Promise<{ ok: true; reading: WellnessReading } | { ok: false; status: number; error: string }>;
  today: () => string;
};

export function chicagoDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function isCalendarDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(y, m - 1, d));
  return parsed.getUTCFullYear() === y && parsed.getUTCMonth() === m - 1 && parsed.getUTCDate() === d;
}

/** Missing, null or "" → null (not sent). Numbers or numeric strings → number. Anything else → NaN. */
function numberField(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim().replace(/,/g, '');
    if (trimmed === '') return null;
    return /^-?\d+(\.\d+)?$/.test(trimmed) ? Number(trimmed) : Number.NaN;
  }
  return typeof value === 'number' ? value : Number.NaN;
}

export function parseWellnessBody(body: unknown, today: string): { ok: true; value: WellnessInput } | { ok: false; error: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'Body must be a JSON object like {"date":"YYYY-MM-DD","sleep_hours":7.5,"steps":8000}' };
  const record = body as Record<string, unknown>;

  const rawDate = record.date === undefined || record.date === null || record.date === '' ? today : record.date;
  if (typeof rawDate !== 'string' || !isCalendarDate(rawDate.trim())) return { ok: false, error: 'date must be a calendar date in YYYY-MM-DD format' };
  const date = rawDate.trim();
  const earliest = shiftDate(today, -WELLNESS_LIMITS.pastDays);
  const latest = shiftDate(today, WELLNESS_LIMITS.futureDays);
  if (date < earliest || date > latest) return { ok: false, error: `date must be between ${earliest} and ${latest} (America/Chicago)` };

  const sleep = numberField(record.sleep_hours);
  if (sleep !== null && !(Number.isFinite(sleep) && sleep >= 0 && sleep <= WELLNESS_LIMITS.maxSleepHours)) {
    return { ok: false, error: 'sleep_hours must be a number from 0 to 24' };
  }
  const steps = numberField(record.steps);
  if (steps !== null && !(Number.isFinite(steps) && steps >= 0 && steps <= WELLNESS_LIMITS.maxSteps)) {
    return { ok: false, error: 'steps must be a number from 0 to 200000' };
  }
  if (sleep === null && steps === null) return { ok: false, error: 'Send sleep_hours, steps, or both' };

  const rawSource = record.source === undefined || record.source === null || record.source === '' ? WELLNESS_DEFAULT_SOURCE : record.source;
  if (typeof rawSource !== 'string' || !SOURCE_PATTERN.test(rawSource)) return { ok: false, error: 'source must be lowercase letters, digits or _ (max 40)' };

  return {
    ok: true,
    value: {
      date,
      sleepHours: sleep === null ? null : Math.round(sleep * 100) / 100,
      steps: steps === null ? null : Math.round(steps),
      source: rawSource,
    },
  };
}

export function wellnessJson(body: unknown, status: number, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extraHeaders },
  });
}

export async function handleWellnessPost(req: Request, deps: WellnessDeps): Promise<Response> {
  const auth = await deps.authenticate(req);
  if (!auth.ok) {
    return wellnessJson({ error: auth.error }, auth.status, auth.status === 401 ? { 'WWW-Authenticate': REALM } : {});
  }
  if (auth.method === 'api_key' && !auth.scopes.includes('quests:write')) {
    return wellnessJson({ error: 'This API key cannot write. Create a key with the default scopes.' }, 403);
  }

  const declared = Number(req.headers.get('content-length') ?? '0');
  if (declared > WELLNESS_LIMITS.maxBodyBytes) return wellnessJson({ error: 'Body too large' }, 413);
  let text: string;
  try {
    text = await req.text();
  } catch {
    return wellnessJson({ error: 'Could not read the request body' }, 400);
  }
  if (text.length > WELLNESS_LIMITS.maxBodyBytes) return wellnessJson({ error: 'Body too large' }, 413);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return wellnessJson({ error: 'Invalid JSON' }, 400);
  }

  const parsed = parseWellnessBody(body, deps.today());
  if (!parsed.ok) return wellnessJson({ error: parsed.error }, 400);

  const saved = await deps.record(auth, parsed.value);
  if (!saved.ok) return wellnessJson({ error: saved.error }, saved.status);
  return wellnessJson({ ok: true, reading: saved.reading }, 200);
}
