import { createHash } from 'node:crypto';
import { HEALTH_INGEST_MAX_BODY_BYTES, isIngestToken, nutritionGameDay, parseHealthIngest, parseNutrition, type HealthIngestBody, type NutritionInput } from './ascension/appleHealth.ts';

const REALM = 'Bearer realm="life-ascension"';

export type IngestOutcome =
  | { ok: true; status: 200; body: Record<string, unknown> }
  | { ok: false; status: number; error: string };

export type HealthIngestDeps = {
  now: () => Date;
  ingest: (tokenHash: string, input: HealthIngestBody, today: string) => Promise<IngestOutcome>;
};

export function hashIngestToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function healthIngestJson(body: unknown, status: number, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extraHeaders },
  });
}

function bearer(header: string | null): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match ? match[1] : null;
}

/**
 * POST /api/health/sleep. The bearer token is hashed before it reaches the database.
 * This function never logs the token, the hash, or the body.
 */
export async function handleHealthIngestPost(req: Request, deps: HealthIngestDeps): Promise<Response> {
  const token = bearer(req.headers.get('authorization'));
  if (!token || !isIngestToken(token)) {
    return healthIngestJson({ error: 'Invalid or revoked token' }, 401, { 'WWW-Authenticate': REALM });
  }
  const declared = Number(req.headers.get('content-length') ?? '0');
  if (Number.isFinite(declared) && declared > HEALTH_INGEST_MAX_BODY_BYTES) {
    return healthIngestJson({ error: 'Body too large' }, 413);
  }
  let text: string;
  try {
    text = await req.text();
  } catch {
    return healthIngestJson({ error: 'Could not read the request body' }, 400);
  }
  if (text.length > HEALTH_INGEST_MAX_BODY_BYTES) return healthIngestJson({ error: 'Body too large' }, 413);
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return healthIngestJson({ error: 'Body must be JSON' }, 400);
  }
  const now = deps.now();
  const parsed = parseHealthIngest(json, now);
  if (!parsed.ok) return healthIngestJson({ error: parsed.error }, 400);
  const outcome = await deps.ingest(hashIngestToken(token), parsed.value, nutritionGameDay(now));
  if (!outcome.ok) {
    const headers: Record<string, string> = outcome.status === 401 ? { 'WWW-Authenticate': REALM } : {};
    return healthIngestJson({ error: outcome.error, xp_awarded: 0 }, outcome.status, headers);
  }
  return healthIngestJson(outcome.body, outcome.status);
}

export type NutritionDeps = {
  record: (tokenHash: string, input: NutritionInput, requestId: string) => Promise<IngestOutcome>;
};

/** POST /api/health/nutrition. Independent of sleep. Never logs the body or token. */
export async function handleNutritionPost(req: Request, deps: NutritionDeps): Promise<Response> {
  const token = bearer(req.headers.get('authorization'));
  if (!token || !isIngestToken(token)) {
    return healthIngestJson({ error: 'Invalid or revoked token' }, 401, { 'WWW-Authenticate': REALM });
  }
  const declared = Number(req.headers.get('content-length') ?? '0');
  if (Number.isFinite(declared) && declared > HEALTH_INGEST_MAX_BODY_BYTES) {
    return healthIngestJson({ error: 'Body too large' }, 413);
  }
  let text: string;
  try {
    text = await req.text();
  } catch {
    return healthIngestJson({ error: 'Could not read the request body' }, 400);
  }
  if (text.length > HEALTH_INGEST_MAX_BODY_BYTES) return healthIngestJson({ error: 'Body too large' }, 413);
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return healthIngestJson({ error: 'Body must be JSON' }, 400);
  }
  const parsed = parseNutrition(json);
  if (!parsed.ok) return healthIngestJson({ error: parsed.error, xp_awarded: 0 }, 400);
  const requestId = typeof (json as { request_id?: unknown }).request_id === 'string'
    ? (json as { request_id: string }).request_id.toLowerCase()
    : '';
  const outcome = await deps.record(hashIngestToken(token), parsed.value, requestId);
  if (!outcome.ok) {
    const headers: Record<string, string> = outcome.status === 401 ? { 'WWW-Authenticate': REALM } : {};
    return healthIngestJson({ error: outcome.error, xp_awarded: 0 }, outcome.status, headers);
  }
  return healthIngestJson(outcome.body, outcome.status);
}

