/**
 * Lights-out credit is its own config. It is not quest_streak_xp and it does
 * not use the flat 10 XP first quest of the game day.
 *
 * Award = LIGHTS_OUT_BASE_XP + LIGHTS_OUT_STREAK_BONUS_XP × prior consecutive
 * lights-out nights. The night being recorded is not part of that prior count,
 * so the bonus is stable for the whole game day. The first night of a run is
 * 5 XP. Each immediately previous recorded night adds 1 XP.
 */
export const LIGHTS_OUT_BASE_XP = 5;
export const LIGHTS_OUT_STREAK_BONUS_XP = 1;
export const LIGHTS_OUT_TITLE = 'Lights Out by 11 PM';
export const LIGHTS_OUT_LOOKBACK_DAYS = 2;
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
