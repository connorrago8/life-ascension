/**
 * Paid model calls stay off until Connor sets NUTRITION_PAID_AI=1.
 * Photo logging stays off until NUTRITION_PHOTO_EXPERIMENT=1 on TEST.
 * Neither flag is implied by a preview deploy.
 */
export function paidAiEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.NUTRITION_PAID_AI === '1';
}

export function photoExperimentEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.NUTRITION_PHOTO_EXPERIMENT === '1';
}

export const MONTHLY_COST_TARGET_USD = 5;
export const MONTHLY_COST_REVIEW_USD = 10;

export function monthlyCostFlag(monthUsd: number): 'within-target' | 'watch' | 'review' {
  if (monthUsd >= MONTHLY_COST_REVIEW_USD) return 'review';
  if (monthUsd >= MONTHLY_COST_TARGET_USD) return 'watch';
  return 'within-target';
}
