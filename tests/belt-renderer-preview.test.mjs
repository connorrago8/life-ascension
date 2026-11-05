import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../components/preview/HomeCharacter.tsx', import.meta.url), 'utf8');

test('belt visual proof is opt-in and leaves the live renderer unchanged', () => {
  assert.match(source, /beltPreviewStage\?: BeltStage/);
  assert.match(source, /beltPreviewStage \? \(/);
  assert.match(source, /<BeltWaistLayer stage=\{beltPreviewStage\} color=\{model\.belt\} \/>/);
  assert.match(source, /\) : \(\s*<>/);
});

test('legacy gear does not stack on the preview belt layer', () => {
  const start = source.indexOf('beltPreviewStage ? (');
  const end = source.indexOf('{/* Arms and fitted bracers;', start);
  const waist = source.slice(start, end);
  assert.ok(start > 0 && end > start);
  assert.match(waist, /\) : \(\s*<>/);
  assert.match(waist, /M96 111 L141 216/);
  assert.equal((waist.match(/<BeltWaistLayer/g) || []).length, 1);
});
