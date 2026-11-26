/**
 * Lights-out credit is its own config. It is not quest_streak_xp and it does
 * not use the flat 10 XP first quest of the game day.
 *
 * Award = LIGHTS_OUT_BASE_XP + min(LIGHTS_OUT_STREAK_BONUS_XP × prior consecutive
 * nights, LIGHTS_OUT_STREAK_BONUS_MAX_XP). The night being recorded is not
 * part of that prior count. The first night is 5 XP. The bonus reaches its
 * cap after 5 prior nights, so a night pays at most 10 XP.
 */
export const LIGHTS_OUT_BASE_XP = 5;
export const LIGHTS_OUT_STREAK_BONUS_XP = 1;
export const LIGHTS_OUT_STREAK_BONUS_MAX_XP = 5;
export const LIGHTS_OUT_TITLE = 'Lights Out by 11 PM';
/** Inclusive bedtime, America/Chicago wall clock. A start after this earns no Lights Out XP. */
export const LIGHTS_OUT_DEADLINE = '23:00';
/**
 * The lights-out night opens at this Chicago wall time. Starts before it are
 * naps. The night closes at the 5:00 AM game-day boundary.
 */
export const LIGHTS_OUT_NIGHT_START = '17:00';
export const LIGHTS_OUT_LOOKBACK_DAYS = 2;
/** Caps for the Cronometer shadow import. Null means missing. Zero is a real observation. */
export const NUTRITION_MAX_KCAL = 20000;
export const NUTRITION_MAX_GRAMS = 2000;
export const LIGHTS_OUT_WEEK_NIGHTS = 7;
export const LIGHTS_OUT_WEEK_GOAL = 6;

export const PAYDAY_TITLE = 'Complete my payday money check';
export const PAYDAY_START = '2026-12-03';
export const PAYDAY_END = '2027-05-20';
export const PAYDAY_INTERVAL_DAYS = 14;

export const FINANCE_DECISIONS = ['minimum_only', 'review_needed', 'extra_payment'] as const;
export type FinanceDecision = (typeof FINANCE_DECISIONS)[number];

export const FINANCE_DECISION_LABEL: Record<FinanceDecision, string> = {
  minimum_only: 'Minimum only',
  review_needed: 'Review needed',
  extra_payment: 'Extra payment',
};

export const FINANCE_FOLLOW_UPS = [
  { kind: 'pay_down_card', title: 'Pay Down a Card' },
  { kind: 'cash_buffer', title: 'Check the Cash Buffer' },
] as const;
export type FinanceFollowUpKind = (typeof FINANCE_FOLLOW_UPS)[number]['kind'];

export const QUEST_CATEGORIES = [
  { id: 'health', label: 'Health', href: '/health' },
  { id: 'finance', label: 'Finance', href: '/finance' },
  { id: 'pharmacy', label: 'Pharmacy', href: '/quests/pharmacy' },
  { id: 'companionship', label: 'Companionship', href: '/quests/companionship' },
  { id: 'personal', label: 'Personal', href: '/quests/personal' },
] as const;
export type QuestCategoryId = (typeof QUEST_CATEGORIES)[number]['id'];
