/** Deterministic free-type activity scorer.
 * No external AI. Keywords + simple duration hints → category + XP tier.
 * Tiers: small=5, medium=10, big=20.
 */

export type XpTier = 'small' | 'medium' | 'big';
export type ActivityCategory = 'chores' | 'fitness' | 'self-care' | 'social' | 'creative' | 'other';

export type ScoreResult = {
  category: ActivityCategory;
  tier: XpTier;
  xp: number;
  confidence: 'high' | 'medium' | 'low';
};

const TIER_XP: Record<XpTier, number> = { small: 5, medium: 10, big: 20 };

const CATEGORY_KEYWORDS: Record<ActivityCategory, string[]> = {
  chores: ['dish', 'laundry', 'clean', 'trash', 'recycl', 'cook', 'dinner', 'vacuum', 'sweep', 'mop', 'bathroom', 'kitchen'],
  fitness: ['yoga', 'run', 'walk', 'gym', 'workout', 'lift', 'cardio', 'stretch', 'exercise', 'hike'],
  'self-care': ['meditat', 'journal', 'bath', 'skincare', 'sleep', 'nap', 'therapy', 'self care'],
  social: ['friend', 'family', 'call', 'date', 'party', 'hangout', 'meetup'],
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

/** One step from the chosen tier. Long and short together leave the tier unchanged. Caps at 5 and 20. */
export function adjustTierForDuration(tier: XpTier, text: string): XpTier {
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

  let tier: XpTier = 'medium';
  if (BIG_KEYWORDS.some((k) => text.includes(k))) tier = 'big';
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
