import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createLatestCharacterLoadGate } from '../lib/preview/latestCharacterLoadGate.ts';

const page = readFileSync(new URL('../app/(app)/character/page.tsx', import.meta.url), 'utf8');

test('focus refresh is synchronously blocked during an equipment RPC', () => {
  assert.match(page, /const equipmentMutationInFlight = useRef\(false\)/);
  const equip = page.slice(page.indexOf('async function setArmorEquipped('), page.indexOf('\n  useEffect('));
  assert.match(equip, /equipmentMutationInFlight\.current = true;/);
  assert.match(equip, /finally\s*\{\s*equipmentMutationInFlight\.current = false;/);
  assert.ok(equip.indexOf('equipmentMutationInFlight.current = true;') < equip.indexOf("rpc('equip_earned_armor'"));
  const refresh = page.slice(page.indexOf('const refreshOnFocus ='), page.indexOf("document.addEventListener('visibilitychange'"));
  assert.match(refresh, /!equipmentMutationInFlight\.current\) void load\(\)/);
});

test('delayed equip prevents focus reads, then permits authoritative reload', async () => {
  const gate = createLatestCharacterLoadGate();
  let inFlight = false;
  let refreshes = 0;
  let resolveMutation;
  const mutation = new Promise(resolve => { resolveMutation = resolve; });
  const refreshOnFocus = () => { if (!inFlight) { refreshes++; return gate.begin(); } };
  const oldRead = gate.begin();
  gate.invalidate();
  inFlight = true;
  assert.equal(refreshOnFocus(), undefined, 'focus cannot initiate a stale read while mutation is pending');
  assert.equal(oldRead(), false);
  resolveMutation();
  await mutation;
  const authoritativeRead = gate.begin();
  assert.equal(authoritativeRead(), true);
  inFlight = false;
  assert.equal(typeof refreshOnFocus(), 'function');
  assert.equal(refreshes, 1);
});
