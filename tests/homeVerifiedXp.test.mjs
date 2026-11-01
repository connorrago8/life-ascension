/** Home must not invent Level 1 when get_lifetime_xp returns malformed data. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { verifiedLifetimeXp } from '../lib/characterXpProof.ts';

const home = readFileSync(new URL('../app/(app)/quests/page.tsx', import.meta.url), 'utf8');

test('Home validates the ledger response and hides level until verified', () => {
  assert.match(home, /const verifiedXp = verifiedLifetimeXp\(ledger\)/);
  assert.match(home, /setXp\(verifiedXp\)/);
  assert.match(home, /if\(verifiedXp===null\)\{/);
  assert.match(home, /const lvl=xp===null\?null:levelFor\(xp\)/);
  assert.match(home, /LEVEL UNAVAILABLE · XP NOT VERIFIED/);
  assert.doesNotMatch(home, /setXp\(coerceXp\(ledger\)\)/);
});

test('Home clears previous-account XP and does not fabricate a level on logout', () => {
  assert.match(home, /setRecoveryIds\(\[\]\);setXp\(null\);\}setUser\(nextAccount\)/);
  assert.match(home, /setRecoveryIds\(\[\]\);setXp\(null\);setUser\(null\)/);
  assert.match(home, /\[xp,setXp\]=useState<number\|null>\(null\)/);
});

test('valid zero XP stays Level 1; invalid ledger data remains unverified', () => {
  assert.equal(verifiedLifetimeXp(0), 0);
  assert.equal(verifiedLifetimeXp('25'), 25);
  for (const malformed of [null, undefined, 'broken', '-1', -1, 1.5, {}, [], Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(verifiedLifetimeXp(malformed), null);
  }
});
