import test from 'node:test';
import assert from 'node:assert/strict';
import { QUEST_CHIPS, parseQuestChip, parseQuestView, taskArea, prioritizePending, questWorkspaceHref, matchesChip } from '../lib/questWorkspace.ts';
import { coupleBucket } from '../lib/coupleQuestView.ts';
import { readSectionOpen, writeSectionOpen } from '../lib/questSections.ts';

test('filters stay on the quest board and old area links still resolve', () => {
  assert.deepEqual(QUEST_CHIPS.map((chip) => chip.id), ['all', 'life', 'partner', 'work', 'together']);
  for (const value of [null, 'other', '//outside.example', '<script>']) assert.equal(parseQuestChip(value), 'all');
  assert.equal(parseQuestChip('izzy'), 'partner');
  assert.equal(parseQuestView('done'), 'done');
  assert.equal(parseQuestView('all'), 'today');
  assert.equal(questWorkspaceHref('work'), '/quests?chip=work');
  assert.equal(questWorkspaceHref('all'), '/quests');
});

test('source membership wins over domain, and every personal task belongs to exactly one category', () => {
  const fromIzzy = new Set(['assigned-career', 'assigned-home']);
  const cases = [['home', 'home', 'life'], ['health', 'physical_health', 'life'], ['finances', 'finance', 'life'], ['weekly', 'career', 'work'], ['assigned-career', 'career', 'izzy'], ['assigned-home', 'home', 'izzy']];
  for (const [id, domain, expected] of cases) assert.equal(taskArea({ id, domain }, fromIzzy), expected);
  assert.equal(matchesChip('life', 'all'), true);
  assert.equal(matchesChip('work', 'life'), false);
  assert.equal(matchesChip('izzy', 'partner'), true);
  assert.equal(matchesChip('life', 'together'), false);
});

test('pagination keeps every pending save reachable without mutating the original list', () => {
  const rows = Array.from({ length: 15 }, (_, i) => ({ instance: { id: String(i) } }));
  const page = prioritizePending(rows, ['12', '14'], 6);
  assert.deepEqual(page.map((row) => row.instance.id), ['12', '14', '0', '1', '2', '3', '4', '5']);
  assert.equal(rows[0].instance.id, '0');
});

test('couple rows stay in the time section of the person who has not finished', () => {
  const open = { id: '1', title: 'Walk', description: null, cadence: 'weekly', dueAt: null, myDone: false, partnerDone: true, awarded: false };
  const mine = { ...open, myDone: true };
  assert.equal(coupleBucket(open, '2026-11-14', '2026-11-21'), 'week');
  assert.equal(coupleBucket(mine, '2026-11-14', '2026-11-21'), 'completed');
  assert.equal(coupleBucket({ ...open, cadence: 'once', dueAt: '2026-12-01T18:00:00Z' }, '2026-11-14', '2026-11-21'), 'upcoming');
});

test('section collapse is stored per id and ignores corrupt values', () => {
  const memory = new Map();
  const storage = { getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) };
  assert.equal(readSectionOpen('week', false, storage), false);
  writeSectionOpen('week', true, storage);
  writeSectionOpen('today', false, storage);
  assert.equal(readSectionOpen('week', false, storage), true);
  assert.equal(readSectionOpen('today', true, storage), false);
  memory.set('la.quest.sections', '{');
  assert.equal(readSectionOpen('week', false, storage), false);
});
