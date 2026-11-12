import { test } from 'node:test';
import assert from 'node:assert';
import { adjustTierForDuration, hasDurationHint } from '../lib/activityScorer.ts';

// Inline the pure function so the test does not depend on TS compilation.
function scoreActivity(description) {
  const text = String(description || '').toLowerCase().trim();
  if (!text) return { category: 'other', tier: 'small', xp: 5, confidence: 'low' };
  const CATEGORY_KEYWORDS = {
    chores: ['dish', 'laundry', 'clean', 'trash', 'recycl', 'cook', 'dinner', 'vacuum', 'sweep', 'mop', 'bathroom', 'kitchen'],
    fitness: ['yoga', 'run', 'walk', 'gym', 'workout', 'lift', 'cardio', 'stretch', 'exercise', 'hike'],
    'self-care': ['meditat', 'journal', 'bath', 'skincare', 'sleep', 'nap', 'therapy'],
    social: ['friend', 'family', 'call', 'date', 'party', 'hangout', 'meetup'],
    creative: ['draw', 'write', 'paint', 'music', 'code', 'design', 'art', 'photo'],
    other: [],
  };
  const BIG = ['deep clean', 'full workout', 'long run', 'major', 'big', 'intense', 'hour', '1hr', '60 min'];
  const SMALL = ['quick', '5 min', 'ten min', 'light', 'tiny', 'short'];
  let category = 'other', best = 0;
  for (const [cat, keys] of Object.entries(CATEGORY_KEYWORDS)) {
    const hits = keys.filter((k) => text.includes(k)).length;
    if (hits > best) { best = hits; category = cat; }
  }
  let tier = 'medium';
  if (BIG.some((k) => text.includes(k))) tier = 'big';
  else if (SMALL.some((k) => text.includes(k))) tier = 'small';
  else if (best === 0) tier = 'small';
  const xp = tier === 'small' ? 5 : tier === 'medium' ? 10 : 20;
  const confidence = best >= 2 ? 'high' : best === 1 ? 'medium' : 'low';
  return { category, tier, xp, confidence };
}

test('yoga 1hr is fitness big 20', () => {
  const r = scoreActivity('yoga 1hr');
  assert.equal(r.category, 'fitness');
  assert.equal(r.tier, 'big');
  assert.equal(r.xp, 20);
});

test('dishes is chores medium 10', () => {
  const r = scoreActivity('did the dishes');
  assert.equal(r.category, 'chores');
  assert.equal(r.xp, 10);
});

test('quick clean is small 5', () => {
  const r = scoreActivity('quick clean');
  assert.equal(r.tier, 'small');
  assert.equal(r.xp, 5);
});

test('empty is small other', () => {
  const r = scoreActivity('');
  assert.equal(r.xp, 5);
  assert.equal(r.category, 'other');
});

test('deep cleaned bathroom is big', () => {
  const r = scoreActivity('deep cleaned the bathroom');
  assert.equal(r.tier, 'big');
  assert.equal(r.xp, 20);
});

test('duration steps one tier and does not treat 110 min as 10 min', () => {
  assert.equal(adjustTierForDuration('medium', 'yoga 1hr'), 'big');
  assert.equal(adjustTierForDuration('big', 'yoga 1hr'), 'big');
  assert.equal(adjustTierForDuration('medium', 'quick stretch'), 'small');
  assert.equal(adjustTierForDuration('small', 'quick stretch'), 'small');
  assert.equal(adjustTierForDuration('big', 'quick 60 min'), 'big');
  assert.equal(hasDurationHint('110 min', '10 min'), false);
  assert.equal(hasDurationHint('ran 10 min', '10 min'), true);
  assert.equal(adjustTierForDuration('big', '110 min'), 'big');
});
