import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const screen = readFileSync(new URL('../components/crypt/CombatView.tsx', import.meta.url), 'utf8');

test('Retry collapses prior combat history before requesting a new attempt', () => {
  assert.match(screen, /onClick=\{\(\) => \{ setShowHistory\(false\); onRetry\(\); \}\}/);
});

test('Combat history remains user-expandable in the same attempt', () => {
  assert.match(screen, /aria-expanded=\{showHistory\}/);
  assert.match(screen, /setShowHistory\(\(current\) => !current\)/);
  assert.match(screen, /showHistory && \(/);
});

test('History reset is only exposed on the defeated battle Retry path', () => {
  assert.match(screen, /battle\.status === 'lost' && \([\s\S]*setShowHistory\(false\); onRetry\(\)/);
  assert.match(screen, /battle\.status === 'won' && \([\s\S]*onClick=\{onContinue\}/);
});
