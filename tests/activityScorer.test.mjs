import { test } from 'node:test';
import assert from 'node:assert';
import { ACTIVITY_EXAMPLES } from '../lib/activityGuide.ts';
import { adjustTierForDuration, hasDurationHint, scoreActivity, xpForTier } from '../lib/activityScorer.ts';
import { levelUpLines, revealForCosmetic } from '../lib/levelUpCopy.ts';
import { PASS_TIERS } from '../lib/companionPass.ts';
import { ADVENTURER_COSMETICS } from '../lib/adventurerCosmetics.ts';
import { readFileSync } from 'node:fs';

test('each of the 60 examples scores its own tier and does not stack', () => {
  assert.equal(ACTIVITY_EXAMPLES.length, 60);
  for (const example of ACTIVITY_EXAMPLES) {
    const scored = scoreActivity(example.title);
    assert.equal(scored.tier, example.tier, example.title);
    assert.equal(scored.xp, xpForTier(example.tier), example.title);
    assert.equal(scored.example, example.title);
  }
});

test('uncertain wording and a long duration stay at the lower tier', () => {
  assert.equal(scoreActivity('').xp, 5);
  assert.equal(scoreActivity('yoga 1hr').tier, 'small');
  assert.equal(scoreActivity('yoga 1hr').xp, 5);
  assert.equal(scoreActivity('full yoga 45 min').xp, 5);
  assert.equal(scoreActivity('30-minute walk').xp, 10);
  assert.equal(scoreActivity('deep cleaned the bathroom').xp, 20);
  assert.equal(scoreActivity('make the bed and cook dinner').xp, 5);
  assert.equal(adjustTierForDuration('medium', 'yoga 1hr'), 'medium');
  assert.equal(adjustTierForDuration('big', 'yoga 1hr'), 'big');
  assert.equal(adjustTierForDuration('medium', 'quick stretch'), 'small');
  assert.equal(adjustTierForDuration('big', 'quick 60 min'), 'big');
  assert.equal(hasDurationHint('110 min', '10 min'), false);
  assert.equal(adjustTierForDuration('big', '10 min stretch'), 'small');
});

test('level-up copy and the 50 reveals stay on the existing ids', () => {
  const izzy = PASS_TIERS.filter((item) => item.grantKind === 'level');
  const connor = ADVENTURER_COSMETICS;
  assert.equal(izzy.length, 25);
  assert.equal(connor.length, 25);
  for (const item of izzy) {
    assert.equal(revealForCosmetic('izzy', item.id), 'From the midnight glow, a new piece of your legend emerges.');
  }
  for (const item of connor) {
    assert.equal(revealForCosmetic('connor', item.id), 'Another hard-earned relic joins your journey.');
  }
  assert.notEqual(revealForCosmetic('izzy', 'cyber-visor'), revealForCosmetic('connor', 'cyber-visor'));
  const reached = levelUpLines('izzy', 30, { id: 'nightcat-headset', label: 'Nightcat Headset' });
  assert.equal(reached.headline, 'LEVEL UP');
  assert.equal(reached.subhead, 'Level 30 reached.');
  assert.equal(reached.body, 'The road remembers every step.');
  assert.equal(reached.gear, 'New gear unlocked: Nightcat Headset.');
  assert.equal(reached.awaiting, null);
  const between = levelUpLines('connor', 3, null);
  assert.equal(between.gear, null);
  assert.equal(between.awaiting, 'Your next gear unlock awaits at Level 4.');
});

test('the activity migration keeps the game day, request id, and refuses a duration upgrade to 20', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261112021405_activity_guide_v3.sql', import.meta.url), 'utf8');
  assert.match(sql, /quest_game_day/);
  assert.match(sql, /Request ID reused with different payload/);
  assert.match(sql, /char_length\(public\.companion_title_key\(v_title\)\) >= 8/);
  assert.doesNotMatch(sql, /v_minutes >= 45|else v_xp := 20/);
  assert.doesNotMatch(sql, /insert into public\.xp_ledger\(/);
  const pack = readFileSync(new URL('../docs/design-pack-v3.md', import.meta.url), 'utf8');
  assert.match(pack, /^LIFE ASCENSION — DESIGN PACK V3/);
  assert.doesNotMatch(readFileSync(new URL('../app/(app)/companion/home/page.tsx', import.meta.url), 'utf8'), /Streak Shield used/);
});
