import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COMPANION_TITLES } from '../lib/companion.ts';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('companion titles are a small curated list shared with SQL', () => {
  const migration = read('supabase/migrations/202611080002_companion_bond.sql');
  assert.deepEqual([...COMPANION_TITLES], [
    'Lantern Keeper', 'Hearth Warden', 'Pathfinder', 'Storyweaver', 'Dawn Herald',
  ]);
  for (const title of COMPANION_TITLES) assert.match(migration, new RegExp(title));
  assert.doesNotMatch(migration, /amount in \(1,\s*2\)/i);
  assert.doesNotMatch(migration, /v_amount\s*:=\s*2/);
  assert.match(migration, /_award_personal_quest_xp/);
  assert.doesNotMatch(migration, /create table[^;]*quest_streak/i);
  assert.match(read('supabase/rollbacks/202611080002_companion_bond_down.sql'), /drop table if exists public\.companion_bonds/);
});

test('companion connection remains available through account settings', () => {
  const page = read('app/(app)/companion/page.tsx');
  const nav = read('app/components/AppNav.tsx');
  const css = read('app/style.css');
  assert.match(nav, /\{item\.label\}/);
  assert.match(read('lib/nav.ts'), /label: 'More'/);
  assert.match(read('app/(app)/more/page.tsx'), /Relationship & invitations/);
  assert.match(read('components/AccountSettings.tsx'), /href="\/companion"/);
  assert.match(page, /className="btn ghost companion-back" href="\/"/);
  assert.match(page, /companion_invite/);
  assert.match(page, /companion_accept/);
  assert.match(page, /companion_send_quest/);
  assert.match(page, /companion_complete_quest/);
  assert.match(page, /companion_log_activity/);
  assert.match(page, /companion_void_activity/);
  assert.match(css, /\.companion-back \{[^}]*min-height: 44px/);
  assert.match(css, /@media \(max-width: 390px\)/);
});
