import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const home = readFileSync(new URL('../app/(app)/page.tsx', import.meta.url), 'utf8');
const completedStart = home.indexOf('{showCompleted&&<div id="completed-quests-list">{completedQuests.map');
const completedEnd = home.indexOf('</section>', completedStart);
const completedCards = home.slice(completedStart, completedEnd);
const details = '<QuestDetails quest={quest} instance={instance!}/>';

test('completed quest cards disclose verified details and retain pending-save recovery', () => {
  assert.ok(completedStart >= 0 && completedEnd > completedStart,
    'completed quest card render branch must be present');
  assert.ok(completedCards.includes(details),
    'completed cards must show objective, due date, status and recorded progress');
  assert.ok(completedCards.includes('<QuestProgressControls '),
    'preserve pending-save recovery on completed tracked quests');
});

test('completed details do not invent XP or duplicate completion actions', () => {
  for (const forbidden of ['completionFeedback(', '.rpc(', '+1 XP earned']) {
    assert.equal(completedCards.includes(forbidden), false, forbidden);
  }
  assert.ok(home.slice(0, completedStart).includes(details),
    'active quest details must remain available');
});
