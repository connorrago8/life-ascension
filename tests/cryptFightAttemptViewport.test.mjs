import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const screen = readFileSync(new URL('../components/crypt/CryptRun.tsx', import.meta.url), 'utf8');
const reducer = readFileSync(new URL('../lib/crypt/run.ts', import.meta.url), 'utf8');

test('Crypt returns to the top after a new fight attempt without requiring a phase change', () => {
  assert.match(screen, /useEffect\(\(\) => \{\s*if \(run\) window\.scrollTo\(0, 0\);\s*\}, \[run\?\.phase, run\?\.fightAttempt\]\);/);
});

test('fight attempt identity changes on entry and retry, including the same encounter', () => {
  assert.match(reducer, /fightAttempt:\s*0,/);
  assert.equal((reducer.match(/fightAttempt: state\.fightAttempt \+ 1/g) ?? []).length, 3);
});

test('scroll effect does not depend on combat turn or log, avoiding per-action jumps', () => {
  const effect = screen.match(/useEffect\(\(\) => \{\s*if \(run\) window\.scrollTo\(0, 0\);\s*\}, \[([^\]]+)\]\);/);
  assert.ok(effect, 'scroll effect must exist');
  assert.equal(effect[1], 'run?.phase, run?.fightAttempt');
  assert.doesNotMatch(effect[1], /battle|turn|log/);
});
