import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../app/(app)/page.tsx', import.meta.url), 'utf8');
const start = page.indexOf('async function add(e:React.FormEvent)');
const end = page.indexOf('async function act(', start);
const handler = page.slice(start, end);

test('quest creation always clears the busy state after RPC rejection', () => {
 assert.ok(start >= 0 && end > start);
 assert.match(handler, /setBusy\(true\);[\s\S]*try\s*\{/);
 assert.match(handler, /catch\s*\{[\s\S]*finally\s*\{\s*questCreateInFlight\.current=false;\s*setBusy\(false\);/);
 assert.match(handler, /Quest creation not confirmed\. Refresh your board before trying again\./);
});

test('quest creation does not automatically retry ambiguous network failures', () => {
 assert.match(handler, /await supabase\(\)\.rpc\('create_scheduled_quest',payload\)/);
 assert.match(handler, /await supabase\(\)\.rpc\('create_tracked_quest'/);
 assert.doesNotMatch(handler, /catch\s*\{[\s\S]*?await supabase\(\)\.rpc/);
});

test('quest creation synchronously prevents double-tap requests', () => {
 assert.match(page, /const questCreateInFlight=useRef\(false\)/);
 assert.match(handler, /if\(!title\.trim\(\)\|\|busy\|\|!user\|\|questCreateInFlight\.current\)return/);
 const acquire = handler.indexOf('questCreateInFlight.current=true;');
 const firstRpc = handler.indexOf("rpc('create_tracked_quest'");
 assert.ok(acquire >= 0 && firstRpc > acquire, 'lock acquired before create RPC');
 assert.match(handler, /finally\s*\{\s*questCreateInFlight\.current=false;/);
});
