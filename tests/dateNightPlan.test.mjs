import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDateNight, sanitizeDateNight } from '../lib/dateNightPlan.ts';

const NOW = new Date('2026-11-12T18:00:00Z');

test('dinner and a movie Friday at 7 becomes two steps at 7pm', () => {
  const plan = parseDateNight('dinner and a movie Friday at 7', NOW);
  assert.ok(plan);
  assert.equal(plan.title, 'Dinner and a movie');
  assert.deepEqual(plan.steps, ['Dinner', 'A movie']);
  assert.deepEqual(plan.due, { weekday: 5, hour: 19, minute: 0 });
});

test('explicit morning times stay in the morning and extra fields are rejected', () => {
  const morning = parseDateNight('coffee and a walk Saturday at 10:30am', NOW);
  assert.deepEqual(morning?.due, { weekday: 6, hour: 10, minute: 30 });
  assert.equal(parseDateNight('just dinner Friday at 7', NOW), null);
  assert.equal(parseDateNight('dinner and a movie and ice cream and a walk and dessert and karaoke Friday at 8', NOW), null);
  assert.equal(parseDateNight('<script>dinner</script> and a movie Friday at 7', NOW)?.steps[0], 'Dinner');
  assert.equal(sanitizeDateNight({
    title: 'Dinner and a movie',
    steps: ['Dinner', 'A movie'],
    due: { weekday: 5, hour: 19, minute: 0 },
    drop: 'users',
  }), null);
  assert.deepEqual(sanitizeDateNight({
    title: 'Dinner and a movie',
    steps: ['Dinner', 'A movie'],
    due: { weekday: 5, hour: 19, minute: 0 },
  })?.steps, ['Dinner', 'A movie']);
});
