import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { xpToReachLevel } from '../lib/level.ts';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const sql = read('supabase/migrations/202611110001_companion_finish.sql');

test('companion clothes unlock on the quest level curve and grant no combat power', () => {
  assert.equal(xpToReachLevel(2), 10);
  assert.equal(xpToReachLevel(5), 70);
  assert.equal(xpToReachLevel(10), 270);
  assert.equal(xpToReachLevel(25), 1620);
  assert.equal(xpToReachLevel(50), 6370);
  assert.match(sql, /'black-shirt', 'Black shirt', 'shirt', 5/);
  assert.match(sql, /'cat-ears', 'Cat ears', 'head', 25/);
  assert.match(sql, /'princess', 'Princess', 'gown', 50/);
  assert.match(sql, /companion_id = new\.owner_id/);
  assert.match(sql, /Companion accounts do not use adventurer gear/);
  assert.doesNotMatch(sql, /record_crypt_floor_clear|crypt_xp_daily/);
});

test('a completed quest instance marks the companion row in the same update', () => {
  assert.match(sql, /after update of status on public\.quest_instances/);
  assert.match(sql, /q\.status in \('accepted', 'sent'\)/);
  assert.match(sql, /sync_companion_quest_from_instance/);
  const down = read('supabase/rollbacks/202611110001_companion_finish_down.sql');
  assert.match(down, /drop trigger if exists companion_quest_status_on_instance/);
});

test('companion home reads server metrics and the wardrobe stays off the adventurer nav', () => {
  const home = read('app/(app)/companion/home/page.tsx');
  const character = read('app/(app)/companion/character/page.tsx');
  const wardrobe = read('components/companion/CompanionWardrobe.tsx');
  assert.match(home, /companion_home_metrics/);
  assert.doesNotMatch(home, /quest\.status/);
  assert.match(character, /CompanionWardrobe/);
  assert.match(wardrobe, /aria-pressed=\{item\.worn\}/);
  assert.match(wardrobe, /companion_wear_cosmetic/);
  assert.doesNotMatch(character, /href="\/play"|nav-play|>Play</);
  assert.doesNotMatch(wardrobe, /strength|agility|href="\/play"/);
  assert.match(read('components/IzzyProof.tsx'), /role="status"/);
  assert.match(read('app/(app)/companion/CompanionHome.tsx'), /♥/);
  assert.match(read('app/(app)/companion/quests/page.tsx'), /\/companion#off-day/);
});
