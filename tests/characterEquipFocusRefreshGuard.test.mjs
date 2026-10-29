import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../app/(app)/character/page.tsx', import.meta.url), 'utf8');
test('focus refresh cannot start a stale equipment read while equip is pending', () => {
 assert.match(source, /const equipmentMutationInFlight = useRef\(false\)/);
 assert.match(source, /equipmentMutationInFlight\.current = true/);
 assert.match(source, /document\.visibilityState === 'visible' && !equipmentMutationInFlight\.current/);
 assert.match(source, /equipmentMutationInFlight\.current = false/);
 assert.match(source, /loadGate\.current\.invalidate\(\)/);
});

test('mutation guard is acquired before equip RPC and released in finally', () => {
 const equipStart = source.indexOf('async function setArmorEquipped');
 const equipEnd = source.indexOf('  useEffect(() =>', equipStart);
 assert.ok(equipStart >= 0 && equipEnd > equipStart);
 const equip = source.slice(equipStart, equipEnd);
 const acquired = equip.indexOf('equipmentMutationInFlight.current = true;');
 const rpc = equip.indexOf("rpc('equip_earned_armor'");
 const finallyBlock = equip.indexOf('} finally {');
 const released = equip.indexOf('equipmentMutationInFlight.current = false;', finallyBlock);
 assert.ok(acquired >= 0 && acquired < rpc, 'guard must be acquired before RPC');
 assert.ok(finallyBlock > rpc && released > finallyBlock, 'guard must clear even on failure');
 assert.match(equip, /equipmentBusy \\|\\| equipmentMutationInFlight\\.current\\) return/);
 assert.match(equip, /setState\\(\\{ status: 'loading' \\}\\);\\s*await load\\(\\)/);
});

test('focus refresh is suppressed until the mutation completes', () => {
 const refresh = source.match(/const refreshOnFocus = \\(\\) => \\{([^\\n]+)\\};/);
 assert.ok(refresh, 'focus callback must exist');
 assert.match(refresh[1], /document\\.visibilityState === 'visible' && !equipmentMutationInFlight\\.current/);
 assert.match(source, /window\\.addEventListener\\('focus', refreshOnFocus\\)/);
 assert.match(source, /document\\.addEventListener\\('visibilitychange', refreshOnFocus\\)/);
});
