import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const home = readFileSync(new URL('../components/quests/PersonalQuestBoard.tsx', import.meta.url), 'utf8');
const completedStart = home.indexOf("instance?.status==='completed'");
const completedEnd = home.indexOf('</article>;', completedStart);
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
  assert.ok(home.includes('taskHref(quest.id)'),
    'active quest details remain reachable from the title');
});
