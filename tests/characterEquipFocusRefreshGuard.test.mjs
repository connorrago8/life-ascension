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
