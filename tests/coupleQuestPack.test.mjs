import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COUPLE_QUEST_PACK, coupleTitleKey, packTitlesToAdd } from '../lib/coupleQuestPack.ts';

const migration = readFileSync(new URL('../supabase/migrations/20261112020810_couple_features.sql', import.meta.url), 'utf8');

test('the starter pack is 15 weekly or monthly quests and carries no base XP', () => {
  assert.equal(COUPLE_QUEST_PACK.length, 15);
  assert.equal(new Set(COUPLE_QUEST_PACK.map((quest) => coupleTitleKey(quest.title))).size, 15);
  assert.equal(COUPLE_QUEST_PACK.every((quest) => quest.cadence === 'weekly' || quest.cadence === 'monthly'), true);
  assert.equal(COUPLE_QUEST_PACK.filter((quest) => quest.cadence === 'monthly').length, 4);
  assert.equal('baseXp' in COUPLE_QUEST_PACK[0], false);
  for (const quest of COUPLE_QUEST_PACK) {
    assert.match(migration, new RegExp(quest.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.ok(quest.description.length > 0 && quest.description.length <= 500);
  }
});

test('adding the pack skips titles the bond already has', () => {
  const pending = packTitlesToAdd(['game night', '  Cook   dinner together ']);
  assert.equal(pending.length, 13);
  assert.equal(pending.some((quest) => quest.title === 'Game night'), false);
  assert.equal(pending.some((quest) => quest.title === 'Cook dinner together'), false);
  assert.equal(packTitlesToAdd([]).length, 15);
});
