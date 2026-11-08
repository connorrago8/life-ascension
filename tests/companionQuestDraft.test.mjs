import test from 'node:test';
import assert from 'node:assert/strict';
import { fallbackQuestDrafts } from '../lib/companionQuestDraft.ts';

const EXAMPLE = 'ok so the clothes have been laying on the floor when are you gonna do them. hey ur laundry is still sitting out. just ran the dishwasher can you put away. trash looks full. do you have an outfit picked out? cardboard boxes have been sitting there for a week please get them gone';

test('Just type fallback turns the sample note into daily chores and one weekly boxes quest', () => {
  const drafts = fallbackQuestDrafts(EXAMPLE);
  assert.deepEqual(drafts.map((item) => [item.title, item.cadence]), [
    ['Fold and put away clothes on the floor', 'daily'],
    ['Put away laundry', 'daily'],
    ['Unload the dishwasher', 'daily'],
    ['Take out the trash', 'daily'],
    ['Pick out an outfit', 'daily'],
    ['Get rid of the cardboard boxes', 'weekly'],
  ]);
  assert.equal(drafts[0].note.startsWith('ok so the clothes'), true);
  assert.match(drafts[5].note, /cardboard boxes/);
});

test('Just type fallback caps at 10 and defaults an ordinary clause to daily', () => {
  const many = Array.from({ length: 12 }, (_, index) => `Task number ${index}.`).join(' ');
  const drafts = fallbackQuestDrafts(many);
  assert.equal(drafts.length, 10);
  assert.equal(drafts.every((item) => item.cadence === 'daily'), true);
  const week = fallbackQuestDrafts('Please deep clean the kitchen this weekend.');
  assert.equal(week[0].title, 'Deep clean');
  assert.equal(week[0].cadence, 'weekly');
});
