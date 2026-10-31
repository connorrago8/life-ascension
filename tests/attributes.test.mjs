import assert from 'node:assert/strict';
import test from 'node:test';
import { ATTRIBUTE_PLACEHOLDER, ATTRIBUTES, attributeValue, adventurerName } from '../lib/attributes.ts';
import { ATTRIBUTE_PREVIEW, EQUIPMENT_PREVIEW } from '../lib/character.ts';

test('preview copy does not offer allocation or equipping', () => {
  assert.equal(ATTRIBUTE_PREVIEW, 'Preview: attribute points arrive in a future update.');
  assert.equal(EQUIPMENT_PREVIEW, 'Preview: equipment coming soon.');
});

test('attributes are only STR, AGI, INT, END, and LCK', () => {
  assert.deepEqual(
    ATTRIBUTES.map((attribute) => [attribute.key, attribute.label, attribute.short]),
    [
      ['strength', 'Strength', 'STR'],
      ['agility', 'Agility', 'AGI'],
      ['intelligence', 'Intelligence', 'INT'],
      ['endurance', 'Endurance', 'END'],
      ['luck', 'Luck', 'LCK'],
    ],
  );
});

test('attributes fall back to a placeholder when the profile has no such column', () => {
  assert.equal(attributeValue(null, 'strength'), ATTRIBUTE_PLACEHOLDER);
  assert.equal(attributeValue(undefined, 'endurance'), ATTRIBUTE_PLACEHOLDER);
  assert.equal(attributeValue({ display_name: 'Ada' }, 'luck'), ATTRIBUTE_PLACEHOLDER);
  assert.equal(attributeValue({ strength: null }, 'strength'), ATTRIBUTE_PLACEHOLDER);
  assert.equal(attributeValue({ intelligence: '  ' }, 'intelligence'), ATTRIBUTE_PLACEHOLDER);
});

test('attributes read numeric or text values when the row actually has them', () => {
  const row = { strength: 3, agility: 1, intelligence: 2, endurance: 0, luck: '4' };
  assert.equal(attributeValue(row, 'strength'), '3');
  assert.equal(attributeValue(row, 'agility'), '1');
  assert.equal(attributeValue(row, 'intelligence'), '2');
  assert.equal(attributeValue(row, 'endurance'), '0');
  assert.equal(attributeValue(row, 'luck'), '4');
});

test('the adventurer name prefers display_name, then the email local part', () => {
  assert.equal(adventurerName('ada@example.com', null), 'ada');
  assert.equal(adventurerName('ada@example.com', '  '), 'ada');
  assert.equal(adventurerName('ada@example.com', 'Ada Wren'), 'Ada Wren');
  assert.equal(adventurerName(null, null), 'Adventurer');
  assert.equal(adventurerName('not-an-email', null), 'not-an-email');
});
