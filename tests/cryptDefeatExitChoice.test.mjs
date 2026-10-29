import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { COMBAT } from '../lib/crypt/content.ts';

const combat = readFileSync(new URL('../components/crypt/CombatView.tsx', import.meta.url), 'utf8');
const screen = readFileSync(new URL('../components/crypt/CryptRun.tsx', import.meta.url), 'utf8');

test('defeat presents Retry and an explicit Return to floor map choice', () => {
  assert.equal(COMBAT.retreat, 'Return to floor map');
  assert.match(combat, /onRetreat: \(\) => void/);
  const defeat = combat.split("{battle.status === 'lost' && (")[1]?.split('\n      )}')[0];
  assert.ok(defeat, 'defeat-only controls exist');
  assert.match(defeat, /onClick=\{(?:onRetry|[\s\S]*?onRetry\(\)[\s\S]*?)\}/);
  assert.match(defeat, /onClick=\{onRetreat\}/);
  assert.ok(defeat.indexOf('onRetry') < defeat.indexOf('onRetreat'));
});

test('retreat calls the existing reducer back command for this fight', () => {
  assert.match(screen, /onRetreat=\{\(\) => dispatch\(\{ type: 'back' \}, run\.phase\)\}/);
  assert.match(screen, /\(\(command\.type === 'continue' \|\| command\.type === 'back'\) && expectedPhase === 'fight'\)/);
  assert.match(screen, /current\.encounterId !== originEncounterId/);
  assert.match(screen, /current\.fightAttempt !== originFightAttempt/);
});
