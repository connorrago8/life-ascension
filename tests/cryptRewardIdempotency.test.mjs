/** QA regression: rapid Crypt choices cannot duplicate temporary rewards or grant XP.
 * Exercises the actual reducer branches without browser, database, or iPhone claims.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../lib/crypt/run.ts', import.meta.url), 'utf8');

function balancedBlock(marker) {
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, 'missing reducer branch: ' + marker);
  const brace = source.indexOf('{', start);
  let depth = 0;
  for (let i = brace; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  assert.fail('unbalanced reducer branch: ' + marker);
}

const reducer = new Function('state', 'command', 'treasureNode', 'eventNode', 'fillTemplate',
  balancedBlock("if (command.type === 'continue')") + '\n' +
  balancedBlock("if (command.type === 'choose')") + '\nreturn state;');

function step(state, command) {
  return reducer(state, command,
    () => ({ attackBonus: 2 }),
    () => ({ choices: [
      { id: 'mend', heal: 5, result: 'Healed {heal}', resultFull: 'Already whole' },
      { id: 'warning', heal: 0, result: 'Warning', resultFull: 'Warning', hint: true },
    ] }),
    (template, values) => template.replace('{heal}', values?.heal ?? ''));
}

function treasureState() {
  return { phase: 'treasure', treasureCleared: false, attackBonus: 0, guardianCleared: false };
}

function eventState() {
  return { phase: 'event', eventCleared: false, hp: 8, maxHp: 10,
    hint: null, eventChoiceId: null, outcomeNote: null };
}

test('two rapid Ember Charm Continue actions award +2 attack exactly once', () => {
  const first = step(treasureState(), { type: 'continue' });
  const second = step(first, { type: 'continue' });
  assert.equal(first.phase, 'map');
  assert.equal(first.treasureCleared, true);
  assert.equal(first.attackBonus, 2);
  assert.equal(second, first, 'stale second Continue must be a no-op');
});

test('double mending choice cannot heal twice or change the first selection', () => {
  const first = step(eventState(), { type: 'choose', choiceId: 'mend' });
  const second = step(first, { type: 'choose', choiceId: 'mend' });
  assert.equal(first.hp, 10);
  assert.equal(first.eventChoiceId, 'mend');
  assert.equal(first.eventCleared, true);
  assert.equal(second, first);
});

test('late alternate inscription choice cannot overwrite the original warning', () => {
  const first = step(eventState(), { type: 'choose', choiceId: 'warning' });
  const second = step(first, { type: 'choose', choiceId: 'mend' });
  assert.equal(first.eventChoiceId, 'warning');
  assert.equal(first.hp, 8);
  assert.equal(second, first);
});

test('unknown inscription choice never heals or clears the event', () => {
  const before = eventState();
  assert.equal(step(before, { type: 'choose', choiceId: 'nonexistent' }), before);
});

test('opening the sealed-door ending does not replay the temporary charm reward', () => {
  const cleared = { ...step(treasureState(), { type: 'continue' }), guardianCleared: true };
  const ending = step(cleared, { type: 'continue' });
  assert.equal(ending.phase, 'end');
  assert.equal(ending.attackBonus, 2);
  assert.equal(step(ending, { type: 'continue' }), ending);
});

test('Crypt choices and repeated navigation never mint XP or persistent equipment', () => {
  const reward = step(treasureState(), { type: 'continue' });
  const event = step(eventState(), { type: 'choose', choiceId: 'mend' });
  const ending = step({ ...reward, guardianCleared: true }, { type: 'continue' });
  for (const state of [reward, event, ending]) {
    assert.equal(Object.hasOwn(state, 'xp'), false);
    assert.equal(Object.hasOwn(state, 'xp_ledger'), false);
    assert.equal(Object.hasOwn(state, 'ownedItemIds'), false);
  }
});
