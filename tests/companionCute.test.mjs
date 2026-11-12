import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { PASS_TIERS, splitCompanionBoard, questGlyph, completedOpenStorageKey } from '../lib/companionPass.ts';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('battle pass uses the dark style track and the tactical Nightcat Headset', () => {
  const byId = Object.fromEntries(PASS_TIERS.map((tier) => [tier.id, tier]));
  assert.equal(byId['fingerless-gloves'].unlockLevel, 2);
  assert.equal(byId['fingerless-gloves'].label, 'Nightgrip Gloves');
  assert.equal(byId['fingerless-gloves'].description, 'Fingerless black gloves worn by the city’s wanderers.');
  assert.equal(byId['obsidian-gown'].label, 'Obsidian Empress');
  assert.equal(byId['nightcat-headset'].description, 'Black cat-ear audio gear with subtle illuminated edges.');
  assert.equal(byId['leather-jacket'].unlockLevel, 10);
  assert.equal(byId['nightcat-headset'].unlockLevel, 30);
  assert.equal(byId['nightcat-headset'].label, 'Nightcat Headset');
  assert.equal(byId['nightcat-headset'].slot, 'head');
  assert.equal(byId['obsidian-gown'].unlockLevel, 50);
  assert.equal(byId['neon-yoga-wrap'].grantKind, 'activity');
  assert.equal(byId['rune-cleaning-drone'].activityNeed, 10);
  assert.equal(byId['cat-ear-headset'], undefined);
  assert.equal(PASS_TIERS.some((tier) => tier.id === 'ribbon' || tier.id === 'yoga-mat'), false);
  const applied = read('supabase/migrations/202611110002_companion_pass.sql');
  assert.match(applied, /'yoga-mat'/);
  assert.match(applied, /'bubble-aura'/);
  assert.doesNotMatch(applied, /fingerless-gloves/);
  const sql = read('supabase/migrations/20261112013453_companion_dark_catalog.sql');
  for (const tier of PASS_TIERS) {
    if (tier.id === 'nightcat-headset') continue;
    assert.match(sql, new RegExp(`'${tier.id}'`));
  }
  assert.doesNotMatch(sql, /cat-ear-headset|nightcat-headset/);
  const headset = read('supabase/migrations/20261112014116_nightcat_headset.sql');
  assert.match(headset, /'nightcat-headset', 'Nightcat Headset', 'head', 30, 15, 'level'/);
  assert.doesNotMatch(headset, /cat-ear-headset|record_crypt_floor_clear|crypt_xp_daily/);
  assert.match(sql, /neon-yoga-wrap/);
  assert.doesNotMatch(sql, /record_crypt_floor_clear|crypt_xp_daily/);
});

test('open quests stay above a collapsed completed section', () => {
  const split = splitCompanionBoard([
    { status: 'completed', title: 'Dishes' },
    { status: 'accepted', title: 'Yoga' },
    { status: 'declined', title: 'Skip' },
  ]);
  assert.deepEqual(split.open.map((quest) => quest.title), ['Yoga']);
  assert.deepEqual(split.done.map((quest) => quest.title), ['Dishes']);
  assert.equal(questGlyph('Do the dishes'), '⚔');
  assert.equal(completedOpenStorageKey('abc'), 'la.companion.completedOpen.abc');
  const board = read('components/companion/QuestBoard.tsx');
  const page = read('app/(app)/companion/quests/page.tsx');
  assert.match(board, /Completed \(\{/);
  assert.match(board, /completedOpen \?\? false/);
  assert.match(board, /localStorage/);
  assert.match(page, /cq-notebook/);
  assert.doesNotMatch(page, /slice\(0,\s*6\)/);
  assert.match(read('app/style.css'), /grid-template-rows: 0fr/);
  assert.match(read('app/style.css'), /--cq-magenta: #ff2bd6/);
  assert.match(read('app/style.css'), /--cq-cyan: #00f0ff/);
  assert.match(read('app/style.css'), /--cq-gold: #c9a227/);
  assert.doesNotMatch(read('app/style.css'), /--cq-rose|--cq-lilac|--cq-blush|--cq-cream|cq-sparkles|cq-heartbar|cq-hearts/);
  assert.match(read('components/companion/QuestBoard.tsx'), /is-compact/);
  assert.doesNotMatch(read('components/companion/QuestBoard.tsx'), /cq-pill is-done/);
  assert.match(read('app/style.css'), /prefers-reduced-motion: reduce/);
  const gallery = read('app/companion-gallery/[screen]/page.tsx');
  assert.match(gallery, /COMPANION_GALLERY/);
  assert.match(gallery, /notFound/);
  const activity = read('supabase/migrations/202611110005_companion_log_activity_v2.sql');
  assert.match(activity, /Future date/);
  assert.match(activity, /Request ID reused with different payload/);
  assert.match(activity, /v_xp := 5/);
  assert.match(activity, /v_xp := 20/);
  assert.doesNotMatch(activity, /_award_personal_quest_xp|quest_streak_xp|insert into public\.xp_ledger\(/);
  const wear = read('supabase/migrations/202611110004_adventurer_wear.sql');
  assert.match(wear, /function public\.level_for_xp/);
  assert.match(wear, /grant select on public\.adventurer_worn to authenticated/);
  assert.doesNotMatch(wear, /grant select, insert, update, delete/);
  const hero = read('components/companion/CompanionHero.tsx');
  assert.doesNotMatch(hero, /#f4f4f4|#c07080|cat-ear-headset/);
  assert.match(hero, /nightcat-headset/);
  assert.match(hero, /on.has\('nightcat'\)/);
  assert.doesNotMatch(read('app/adventurer-dark.css'), /^\.screen,|^\.btn \{/m);
  assert.doesNotMatch(read('app/polish.css'), /\.screen \*/);
});
