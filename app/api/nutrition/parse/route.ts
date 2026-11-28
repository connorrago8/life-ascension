import { NextRequest, NextResponse } from 'next/server';
import { applyPendingCookies, readSessionUser } from '../../../../lib/supabaseServer';
import { measuredDeterministicCost } from '../../../../lib/nutrition/cost';
import { paidAiEnabled, photoExperimentEnabled } from '../../../../lib/nutrition/config';
import { applyFdcFood, searchFdc } from '../../../../lib/nutrition/fdc';
import { parseMealText } from '../../../../lib/nutrition/parseFood';
import type { DraftItem, DraftMeal, HistoryMeal, MemoryMeal, PortionMemory } from '../../../../lib/nutrition/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_TEXT = 1000;
const MAX_PHOTO_BYTES = 4_000_000;

/**
 * Photos are analyzed in the request and not stored. The diary keeps the
 * confirmed foods, not the image. Photo analysis stays off unless
 * NUTRITION_PHOTO_EXPERIMENT=1, and it still refuses a paid model unless
 * NUTRITION_PAID_AI=1.
 */
export async function POST(request: NextRequest) {
  const started = Date.now();
  const session = await readSessionUser(request);
  const contentType = request.headers.get('content-type') ?? '';

  if (contentType.includes('multipart/form-data')) {
    return photoResponse(request, session.pendingCookies, started);
  }

  let text = '';
  let requestId = '';
  let memory: MemoryMeal[] = [];
  let history: HistoryMeal[] = [];
  let portions: PortionMemory[] = [];
  try {
    const body = await request.json() as {
      text?: unknown;
      requestId?: unknown;
      memory?: unknown;
      history?: unknown;
      portions?: unknown;
    };
    text = typeof body.text === 'string' ? body.text : '';
    requestId = typeof body.requestId === 'string' ? body.requestId : '';
    memory = Array.isArray(body.memory) ? body.memory as MemoryMeal[] : [];
    history = Array.isArray(body.history) ? body.history as HistoryMeal[] : [];
    portions = Array.isArray(body.portions) ? body.portions as PortionMemory[] : [];
  } catch {
    text = '';
  }
  if (text.trim().length < 1 || text.length > MAX_TEXT) {
    return applyPendingCookies(NextResponse.json({ error: 'Keep the note under 1000 characters.' }, { status: 400 }), session.pendingCookies);
  }

  const parsed = parseMealText(text, { now: new Date(), memory, history, portions });
  let meals = parsed.meals;
  let provider: 'deterministic' | 'fdc' | 'gateway' = 'deterministic';
  const usage = { inputTokens: 0, outputTokens: 0, estimatedUsd: 0, paidAi: false as boolean };
  const needsModel = meals.some((meal) => meal.items.some((item) => item.source === 'convention'));
  if (paidAiEnabled() && needsModel) {
    const modeled = await paidTextEstimate(text);
    if (modeled) {
      provider = 'gateway';
      usage.inputTokens = modeled.inputTokens;
      usage.outputTokens = modeled.outputTokens;
      usage.estimatedUsd = modeled.estimatedUsd;
      usage.paidAi = true;
    }
  }

  const fdcKey = process.env.USDA_FDC_API_KEY;
  if (fdcKey) {
    meals = await enrichMeals(meals, fdcKey);
    if (meals.some((meal) => meal.items.some((item) => item.source === 'usda_fdc'))) provider = 'fdc';
  }

  const durationMs = Date.now() - started;
  const persisted = await recordParse(request, session.user?.id, requestId, 'text', provider, usage, durationMs);
  return applyPendingCookies(NextResponse.json({
    meals,
    usage,
    durationMs,
    provider,
    persisted,
    requestId,
    configured: { ai: paidAiEnabled(), fdc: Boolean(fdcKey) },
  }), session.pendingCookies);
}

async function photoResponse(request: NextRequest, pendingCookies: Awaited<ReturnType<typeof readSessionUser>>['pendingCookies'], started: number) {
  if (!photoExperimentEnabled()) {
    return applyPendingCookies(NextResponse.json({ error: 'Photo logging is off.' }, { status: 403 }), pendingCookies);
  }
  const form = await request.formData();
  const photo = form.get('photo');
  if (!(photo instanceof File)) {
    return applyPendingCookies(NextResponse.json({ error: 'Choose a photo.' }, { status: 400 }), pendingCookies);
  }
  if (photo.size > MAX_PHOTO_BYTES) {
    return applyPendingCookies(NextResponse.json({ error: 'Use a photo under 4 MB.' }, { status: 400 }), pendingCookies);
  }
  const bytes = new Uint8Array(await photo.arrayBuffer());
  if (!imageMediaType(bytes)) {
    return applyPendingCookies(NextResponse.json({ error: 'Use a JPEG, PNG, or WebP photo.' }, { status: 400 }), pendingCookies);
  }
  if (!paidAiEnabled()) {
    return applyPendingCookies(NextResponse.json({
      meals: [],
      blocked: 'paid-ai-off',
      usage: measuredDeterministicCost(),
      durationMs: Date.now() - started,
      message: 'Photo analysis needs an approved AI budget. Type the meal instead. Nothing was saved.',
    }), pendingCookies);
  }
  return applyPendingCookies(NextResponse.json({
    meals: [],
    blocked: 'vision-unconfigured',
    usage: measuredDeterministicCost(),
    durationMs: Date.now() - started,
    message: 'Photo analysis is enabled, and the vision call is not configured on this server. Type the meal instead.',
  }), pendingCookies);
}

async function enrichMeals(meals: DraftMeal[], apiKey: string): Promise<DraftMeal[]> {
  const next: DraftMeal[] = [];
  for (const meal of meals) {
    const items: DraftItem[] = [];
    for (const item of meal.items) {
      if (item.source !== 'generic' && item.source !== 'convention') {
        items.push(item);
        continue;
      }
      try {
        const food = await searchFdc(item.name, apiKey, fetch, AbortSignal.timeout(4000));
        items.push(food ? applyFdcFood(item, food) ?? item : item);
      } catch {
        items.push(item);
      }
    }
    next.push({ ...meal, items });
  }
  return next;
}

async function recordParse(
  request: NextRequest,
  userId: string | undefined,
  requestId: string,
  channel: 'text' | 'photo',
  provider: string,
  usage: { inputTokens: number; outputTokens: number; estimatedUsd: number },
  durationMs: number,
): Promise<boolean> {
  if (!userId || !/^[0-9a-f-]{36}$/i.test(requestId)) return false;
  const { createServerClient } = await import('@supabase/ssr');
  const { readServerSupabaseConfig } = await import('../../../../lib/supabaseRuntimeConfig');
  const config = await readServerSupabaseConfig();
  if (!config) return false;
  const client = createServerClient(config.url, config.key, {
    cookies: { getAll: () => request.cookies.getAll(), setAll: () => undefined },
  });
  const { error } = await client.rpc('record_nutrition_parse', {
    p_request_id: requestId,
    p_channel: channel,
    p_provider: provider,
    p_model: null,
    p_input_tokens: usage.inputTokens,
    p_output_tokens: usage.outputTokens,
    p_estimated_usd: usage.estimatedUsd,
    p_duration_ms: durationMs,
  });
  return !error;
}

async function paidTextEstimate(text: string): Promise<{ inputTokens: number; outputTokens: number; estimatedUsd: number } | null> {
  if (!paidAiEnabled()) return null;
  try {
    const { generateText, Output } = await import('ai');
    const { z } = await import('zod');
    const { estimateUsd, readTokenRates } = await import('../../../../lib/nutrition/cost');
    const schema = z.object({
      items: z.array(z.object({
        name: z.string(),
        quantity: z.coerce.number(),
        unit: z.string(),
        calories: z.coerce.number(),
        protein_g: z.coerce.number(),
        carbs_g: z.coerce.number(),
        fat_g: z.coerce.number(),
      })).max(12),
    });
    const result = await generateText({
      model: process.env.NUTRITION_AI_MODEL || process.env.AI_GATEWAY_MODEL || 'openai/gpt-5.4-mini',
      output: Output.object({ schema }),
      abortSignal: AbortSignal.timeout(8000),
      prompt: `List foods in this note with amounts and calories, protein grams, carbohydrate grams, and fat grams. Do not add foods that are not in the note. Do not comment on weight, dieting, or whether the amount is high or low.\n${text.slice(0, 1000)}`,
    });
    const inputTokens = result.usage?.inputTokens ?? 0;
    const outputTokens = result.usage?.outputTokens ?? 0;
    return { inputTokens, outputTokens, estimatedUsd: estimateUsd(inputTokens, outputTokens, readTokenRates()) };
  } catch {
    return null;
  }
}

function imageMediaType(bytes: Uint8Array): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (bytes.length > 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'image/webp';
  return null;
}
