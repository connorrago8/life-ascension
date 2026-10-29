import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createLatestCharacterLoadGate } from '../lib/preview/latestCharacterLoadGate.ts';

const page = readFileSync(new URL('../app/(app)/character/page.tsx', import.meta.url), 'utf8');

test('equipping invalidates pre-mutation focus loads before the server RPC', () => {
  const start = page.indexOf('async function setArmorEquipped(');
  const end = page.indexOf('\n  useEffect(', start);
  assert.ok(start >= 0 && end > start, 'Character equip handler must exist');
  const handler = page.slice(start, end);
  const guard = handler.indexOf("if (state.status !== 'ready'");
  const invalidate = handler.indexOf('loadGate.current.invalidate();');
  const rpc = handler.indexOf("rpc('equip_earned_armor'");
  assert.ok(guard >= 0 && invalidate > guard && rpc > invalidate,
    'a guarded equip must invalidate stale reads before invoking the server mutation');
  assert.match(handler, /await load\(\);/, 'successful equip must refresh server gear');
});

test('an older focus response is rejected at the equip boundary', () => {
  const gate = createLatestCharacterLoadGate();
  const focusRead = gate.begin();
  gate.invalidate(); // equip begins while the focus read is pending
  assert.equal(focusRead(), false);
  const serverReadAfterEquip = gate.begin();
  assert.equal(serverReadAfterEquip(), true);
});
