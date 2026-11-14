import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COUPLE_QUEST_PACK, coupleTitleKey, packTitlesToAdd } from '../lib/coupleQuestPack.ts';

const migration = readFileSync(new URL('../supabase/migrations/202611140001_replace_cook_dinner_pack.sql', import.meta.url), 'utf8');
const rollback = readFileSync(new URL('../supabase/rollbacks/202611140001_replace_cook_dinner_pack_down.sql', import.meta.url), 'utf8');

test('the starter pack is 15 weekly or monthly quests and carries no base XP', () => {
  assert.equal(COUPLE_QUEST_PACK.length, 15);
  assert.equal(new Set(COUPLE_QUEST_PACK.map((quest) => coupleTitleKey(quest.title))).size, 15);
  assert.equal(COUPLE_QUEST_PACK.every((quest) => quest.cadence === 'weekly' || quest.cadence === 'monthly'), true);
  assert.equal(COUPLE_QUEST_PACK.filter((quest) => quest.cadence === 'monthly').length, 4);
  assert.equal(COUPLE_QUEST_PACK.some((quest) => /cook dinner/i.test(quest.title)), false);
  assert.equal('baseXp' in COUPLE_QUEST_PACK[0], false);
  for (const quest of COUPLE_QUEST_PACK) {
    assert.match(migration, new RegExp(quest.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.ok(quest.description.length > 0 && quest.description.length <= 500);
  }
  assert.match(rollback, /Cook dinner together/);
  assert.doesNotMatch(migration.split(') as pack')[0], /Cook dinner together/);
  assert.match(migration, /couple_title_key\('Cook dinner together'\)/);
});

test('adding the pack skips titles the bond already has', () => {
  const pending = packTitlesToAdd(['game night', '  Evening   wind-down ']);
  assert.equal(pending.length, 13);
  assert.equal(pending.some((quest) => quest.title === 'Game night'), false);
  assert.equal(pending.some((quest) => quest.title === 'Evening wind-down'), false);
  assert.equal(packTitlesToAdd([]).length, 15);
});
