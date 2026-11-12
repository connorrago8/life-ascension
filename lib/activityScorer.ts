/** Deterministic free-type activity scorer.
 * The 60 examples in activityGuide are the tier guide.
 * Uncertain text takes the lower tier. A long duration does not grant 20 XP.
 * One description is one award; matching two examples does not add their XP.
 */

import { chooseExample } from './activityGuide.ts';

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
  /** Example title when the guide matched. Empty when the lower tier was the fallback. */
  example: string | null;
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

/** Short wording can lower a tier. It never raises one. */
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

/** Named minutes. Under 15 is small and 15–44 is medium. 45 or more is not an automatic 20. */
export function tierForMinutes(minutes: number): XpTier {
  if (minutes < 15) return 'small';
  if (minutes < 45) return 'medium';
  return 'big';
}

/** Minutes can only lower a tier. Forty-five minutes or more does not become 20 XP by itself. */
export function adjustTierForDuration(tier: XpTier, text: string): XpTier {
  const minutes = minutesHint(text);
  if (minutes != null) {
    if (minutes < 15) return 'small';
    if (minutes < 45 && tier === 'big') return 'medium';
    return tier;
  }
  const hay = text.toLowerCase();
  const short = SHORT_DURATION.some((hint) => hasDurationHint(hay, hint));
  if (!short) return tier;
  if (tier === 'big') return 'medium';
  if (tier === 'medium') return 'small';
  return tier;
}

export function xpForTier(tier: XpTier): number {
  return TIER_XP[tier];
}

export function scoreActivity(description: string): ScoreResult {
  const text = description.toLowerCase().trim();
  if (!text) return { category: 'other', tier: 'small', xp: 5, confidence: 'low', example: null };

  let category: ActivityCategory = 'other';
  let best = 0;
  for (const [cat, keys] of Object.entries(CATEGORY_KEYWORDS) as [ActivityCategory, string[]][]) {
    const hits = keys.filter((k) => text.includes(k)).length;
    if (hits > best) {
      best = hits;
      category = cat;
    }
  }

  const example = chooseExample(text);
  // No guide match is uncertain, so the award stays at the lower tier.
  const tier: XpTier = example?.tier ?? 'small';
  const confidence: ScoreResult['confidence'] = example ? 'high' : best >= 1 ? 'low' : 'low';

  return {
    category,
    tier,
    xp: TIER_XP[tier],
    confidence,
    example: example?.title ?? null,
  };
}
