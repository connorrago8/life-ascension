/** Stand-in rates for a future approved model. Default logs do not call a model, so measured cost is $0. */
export const DEFAULT_INPUT_USD_PER_MILLION = 0.15;
export const DEFAULT_OUTPUT_USD_PER_MILLION = 0.6;

export type TokenRates = { inputPerMillion: number; outputPerMillion: number };

export function readTokenRates(env: Record<string, string | undefined> = process.env): TokenRates {
  return {
    inputPerMillion: positive(env.NUTRITION_AI_INPUT_USD_PER_MILLION, DEFAULT_INPUT_USD_PER_MILLION),
    outputPerMillion: positive(env.NUTRITION_AI_OUTPUT_USD_PER_MILLION, DEFAULT_OUTPUT_USD_PER_MILLION),
  };
}

export function estimateUsd(inputTokens: number, outputTokens: number, rates: TokenRates = readTokenRates()): number {
  const input = Math.max(0, inputTokens);
  const output = Math.max(0, outputTokens);
  const usd = (input / 1_000_000) * rates.inputPerMillion + (output / 1_000_000) * rates.outputPerMillion;
  return Math.round(usd * 1_000_000) / 1_000_000;
}

/** Deterministic text logging, favorites, edits, and summaries. */
export function measuredDeterministicCost(): { inputTokens: 0; outputTokens: 0; estimatedUsd: 0; paidAi: false } {
  return { inputTokens: 0, outputTokens: 0, estimatedUsd: 0, paidAi: false };
}

function positive(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}
