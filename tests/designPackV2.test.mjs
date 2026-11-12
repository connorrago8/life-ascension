import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COUPLE_QUEST_PACK } from '../lib/coupleQuestPack.ts';
import { DATE_NIGHT_IDEAS } from '../lib/dateNightIdeas.ts';
import { RECAP_HEADLINES, recapHeadline, recapLines } from '../lib/recapTemplate.ts';

const pack = readFileSync(new URL('../docs/design-pack-v2.txt', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../supabase/migrations/202611120002_design_pack_v2.sql', import.meta.url), 'utf8');

test('design pack v2 is stored verbatim', () => {
  assert.match(pack, /^LIFE ASCENSION — CONTENT & DESIGN PACK V2\n/);
  assert.match(pack, /No code, database, branch, or deployment changes authorized\./);
});

test('Sunday recap uses the ten headlines and refuses an invented moment', () => {
  assert.equal(RECAP_HEADLINES.length, 10);
  const lines = recapLines({
    weekStart: '2026-11-08',
    weekEnd: '2026-11-15',
    connorXp: 30,
    connorLevel: 3,
    izzyXp: 10,
    izzyLevel: 2,
    coupleQuestsCompleted: 0,
    bestMomentTitle: null,
    coupleQuestTitle: null,
    unlockNames: [],
    nextQuestTitle: null,
    seed: 'bond-1',
  });
  assert.equal(RECAP_HEADLINES.includes(lines[0]), true);
  assert.match(lines[1], /Your week in Life Ascension · Nov 8–Nov 15/);
  assert.equal(lines[2], 'Connor: +30 XP · Level 3');
  assert.equal(lines[3], 'Izzy: +10 XP · Level 2');
  assert.equal(lines[5], 'Your next favorite moment is still ahead.');
  assert.match(lines[6], /No couple quest completed this week/);
  assert.match(lines[7], /No new gear this week/);
  assert.equal(recapHeadline('bond-1'), recapHeadline('bond-1'));
  for (const quest of COUPLE_QUEST_PACK) {
    const sql = quest.description.replace(/'/g, "''").replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(migration, new RegExp(sql));
    assert.equal(pack.includes(quest.description), true);
  }
});

test('thirty date-night ideas carry cost, duration, and home or out', () => {
  assert.equal(DATE_NIGHT_IDEAS.length, 30);
  assert.equal(new Set(DATE_NIGHT_IDEAS.map((idea) => idea.id)).size, 30);
  for (const idea of DATE_NIGHT_IDEAS) {
    assert.equal(['$', '$$', '$$$'].includes(idea.cost), true);
    assert.equal(['short', 'evening', 'full_day'].includes(idea.duration), true);
    assert.equal(['home', 'out'].includes(idea.setting), true);
    assert.match(migration, new RegExp(idea.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(migration, /sunday_chicago_5am_previous_7/);
  assert.match(migration, /chicago_5am_on_the_1st/);
});
