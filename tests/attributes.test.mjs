import assert from 'node:assert/strict';
import test from 'node:test';
import { ATTRIBUTE_PLACEHOLDER, ATTRIBUTES, attributeValue, adventurerName } from '../lib/attributes.ts';

test('attributes are only STR, INT, VIT, and DIS', () => {
  assert.deepEqual(
    ATTRIBUTES.map((attribute) => [attribute.key, attribute.label, attribute.short]),
    [
      ['strength', 'Strength', 'STR'],
      ['intelligence', 'Intelligence', 'INT'],
      ['vitality', 'Vitality', 'VIT'],
      ['discipline', 'Discipline', 'DIS'],
    ],
  );
});

test('attributes fall back to a placeholder when the profile has no such column', () => {
  assert.equal(attributeValue(null, 'strength'), ATTRIBUTE_PLACEHOLDER);
  assert.equal(attributeValue(undefined, 'vitality'), ATTRIBUTE_PLACEHOLDER);
  assert.equal(attributeValue({ display_name: 'Ada' }, 'discipline'), ATTRIBUTE_PLACEHOLDER);
  assert.equal(attributeValue({ strength: null }, 'strength'), ATTRIBUTE_PLACEHOLDER);
  assert.equal(attributeValue({ intelligence: '  ' }, 'intelligence'), ATTRIBUTE_PLACEHOLDER);
});

test('attributes read numeric or text values when the row actually has them', () => {
  const row = { strength: 3, intelligence: 2, vitality: 0, discipline: '4' };
  assert.equal(attributeValue(row, 'strength'), '3');
  assert.equal(attributeValue(row, 'intelligence'), '2');
  assert.equal(attributeValue(row, 'vitality'), '0');
  assert.equal(attributeValue(row, 'discipline'), '4');
});

test('the adventurer name prefers display_name, then the email local part', () => {
  assert.equal(adventurerName('ada@example.com', null), 'ada');
  assert.equal(adventurerName('ada@example.com', '  '), 'ada');
  assert.equal(adventurerName('ada@example.com', 'Ada Wren'), 'Ada Wren');
  assert.equal(adventurerName(null, null), 'Adventurer');
  assert.equal(adventurerName('not-an-email', null), 'not-an-email');
});
