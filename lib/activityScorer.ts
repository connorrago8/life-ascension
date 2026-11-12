/** Deterministic free-type activity scorer.
 * No external AI. Keywords + simple duration hints → category + XP tier.
 * Tiers: small=5, medium=10, big=20.
 */

export type XpTier = 'small' | 'medium' | 'big';
export type ActivityCategory =
  | 'chores'
  | 'cooking'
  | 'fitness'
  | 'self-care'
  | 'organization'
  | 'growth'
  | 'relationships'
  | 'social'
  | 'creative'
  | 'other';

export type ScoreResult = {
  category: ActivityCategory;
  tier: XpTier;
  xp: number;
  confidence: 'high' | 'medium' | 'low';
};

const TIER_XP: Record<XpTier, number> = { small: 5, medium: 10, big: 20 };

const CATEGORY_KEYWORDS: Record<ActivityCategory, string[]> = {
  chores: ['dish', 'laundry', 'clean', 'trash', 'recycl', 'vacuum', 'sweep', 'mop', 'bathroom', 'kitchen'],
  cooking: ['snack', 'meal prep', 'cook', 'dinner', 'recipe'],
  fitness: ['yoga', 'run', 'walk', 'gym', 'workout', 'lift', 'cardio', 'stretch', 'exercise', 'hike'],
  'self-care': ['meditat', 'journal', 'bath', 'skincare', 'sleep', 'nap', 'therapy', 'self care', 'relax'],
  organization: ['countertop', 'drawer', 'declutter', 'organize', 'tidy'],
  growth: ['read', 'study', 'learn', 'lesson', 'practice'],
  relationships: ['message', 'loved one', 'gathering', 'host', 'call'],
  social: ['friend', 'family', 'date', 'party', 'hangout', 'meetup'],
  creative: ['draw', 'write', 'paint', 'music', 'code', 'design', 'art', 'photo'],
  other: [],
};

const BIG_KEYWORDS = ['deep clean', 'full workout', 'long run', 'major', 'big', 'intense', 'hour', '1hr', '60 min'];
const SMALL_KEYWORDS = ['quick', '5 min', 'ten min', 'light', 'tiny', 'short'];

/** Hints the server uses to step a tier once. Keep in sync with companion_log_activity_v2. */
const LONG_DURATION = ['hour', '1hr', '60 min', '90 min', '2 hr'];
const SHORT_DURATION = ['quick', '5 min', '10 min', 'ten min'];

/** A hint that starts with a digit must not continue a longer number ("10 min" vs "110 min"). */
export function hasDurationHint(text: string, hint: string): boolean {
  const escaped = hint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = /^\d/.test(hint) ? new RegExp(`(^|[^0-9])${escaped}`) : new RegExp(escaped);
  return pattern.test(text);
}

/** Minutes named in the text. An hour is 60. A digit glued to a longer number does not count. */
export function minutesHint(text: string): number | null {
  const hay = text.toLowerCase();
  const minute = hay.match(/(^|[^0-9])(\d+)\s*min/);
  if (minute) return Number(minute[2]);
  if (hasDurationHint(hay, '2 hr')) return 120;
  if (hay.includes('hour') || hasDurationHint(hay, '1hr')) return 60;
  return null;
}

/** Duration bands from the content pack: under 15 small, 15–44 medium, 45+ big. Never above 20 XP. */
export function tierForMinutes(minutes: number): XpTier {
  if (minutes < 15) return 'small';
  if (minutes < 45) return 'medium';
  return 'big';
}

/** Explicit minutes set the tier. Otherwise one keyword step. Result stays in 5/10/20. */
export function adjustTierForDuration(tier: XpTier, text: string): XpTier {
  const minutes = minutesHint(text);
  if (minutes != null) return tierForMinutes(minutes);
  const hay = text.toLowerCase();
  const long = LONG_DURATION.some((hint) => hasDurationHint(hay, hint));
  const short = SHORT_DURATION.some((hint) => hasDurationHint(hay, hint));
  if (long && !short) return tier === 'small' ? 'medium' : 'big';
  if (short && !long) return tier === 'big' ? 'medium' : 'small';
  return tier;
}

export function xpForTier(tier: XpTier): number {
  return TIER_XP[tier];
}

export function scoreActivity(description: string): ScoreResult {
  const text = description.toLowerCase().trim();
  if (!text) return { category: 'other', tier: 'small', xp: 5, confidence: 'low' };

  let category: ActivityCategory = 'other';
  let best = 0;
  for (const [cat, keys] of Object.entries(CATEGORY_KEYWORDS) as [ActivityCategory, string[]][]) {
    const hits = keys.filter((k) => text.includes(k)).length;
    if (hits > best) {
      best = hits;
      category = cat;
    }
  }

  const minutes = minutesHint(text);
  let tier: XpTier = 'medium';
  if (minutes != null) tier = tierForMinutes(minutes);
  else if (BIG_KEYWORDS.some((k) => text.includes(k))) tier = 'big';
  else if (SMALL_KEYWORDS.some((k) => text.includes(k))) tier = 'small';
  else if (best === 0) tier = 'small';

  const confidence: ScoreResult['confidence'] = best >= 2 ? 'high' : best === 1 ? 'medium' : 'low';

  return {
    category,
    tier,
    xp: TIER_XP[tier],
    confidence,
  };
}
