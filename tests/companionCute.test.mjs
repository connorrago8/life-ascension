import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { PASS_TIERS, splitCompanionBoard, questGlyph, completedOpenStorageKey } from '../lib/companionPass.ts';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('battle pass keeps the original level unlocks and adds activity rewards', () => {
  const byId = Object.fromEntries(PASS_TIERS.map((tier) => [tier.id, tier]));
  assert.equal(byId.ribbon.unlockLevel, 2);
  assert.equal(byId['black-shirt'].unlockLevel, 5);
  assert.equal(byId['cat-ears'].unlockLevel, 25);
  assert.equal(byId.princess.unlockLevel, 50);
  assert.equal(byId['yoga-mat'].grantKind, 'activity');
  assert.equal(byId['bubble-aura'].activityNeed, 10);
  const sql = read('supabase/migrations/202611110002_companion_pass.sql');
  for (const tier of PASS_TIERS) {
    if (tier.id === 'ribbon' || tier.id === 'black-shirt' || tier.id === 'lantern-pin' || tier.id === 'cat-ears' || tier.id === 'princess') continue;
    assert.match(sql, new RegExp(`'${tier.id}'`));
  }
  assert.match(sql, /grant_kind = 'level'/);
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
  assert.equal(questGlyph('Do the dishes'), '♡');
  assert.equal(completedOpenStorageKey('abc'), 'la.companion.completedOpen.abc');
  const board = read('components/companion/QuestBoard.tsx');
  const page = read('app/(app)/companion/quests/page.tsx');
  assert.match(board, /Completed \(\{/);
  assert.match(board, /completedOpen \?\? false/);
  assert.match(board, /localStorage/);
  assert.match(page, /cq-notebook/);
  assert.doesNotMatch(page, /slice\(0,\s*6\)/);
  assert.match(read('app/style.css'), /grid-template-rows: 0fr/);
  assert.match(read('app/style.css'), /cubic-bezier\(0\.34, 1\.4, 0\.64, 1\)/);
  assert.match(read('app/style.css'), /cq-sparkles/);
  assert.match(read('app/style.css'), /\.companion-shell \.btn\.ghost \{\s*color: #2a1a22/);
  assert.match(read('components/companion/QuestBoard.tsx'), /is-compact/);
  assert.doesNotMatch(read('components/companion/QuestBoard.tsx'), /cq-pill is-done/);
  assert.match(read('app/style.css'), /prefers-reduced-motion: reduce/);
  const gallery = read('app/companion-gallery/[screen]/page.tsx');
  assert.match(gallery, /COMPANION_GALLERY/);
  assert.match(gallery, /notFound/);
});
