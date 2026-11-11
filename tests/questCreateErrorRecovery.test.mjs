import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../app/(app)/quests/page.tsx', import.meta.url), 'utf8');
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

test('confirmed quest creation is not misreported when board refresh fails', () => {
 assert.match(handler, /if\(error\)\{setMessage\(error\.message\);return\}/);
 assert.match(handler, /setMessage\('Quest scheduled\.'\);[\s\S]*try\s*\{\s*await load\(\);\s*\}\s*catch\s*\{/);
 assert.match(handler, /Quest created, but board refresh failed\. Refresh to view it; do not add it again\./);
 assert.match(handler, /Quest creation not confirmed\. Refresh your board before trying again\./);
});

test('account changes invalidate a pending quest creation response', () => {
 assert.match(handler, /const operationAccount=accountRef\.current/);
 assert.match(handler, /if\(accountRef\.current!==operationAccount\)return/);
 assert.match(handler, /if\(accountRef\.current===operationAccount\)setMessage/);
});
