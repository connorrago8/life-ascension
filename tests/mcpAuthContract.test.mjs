import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const route = readFileSync(new URL('../app/api/mcp/route.ts', import.meta.url), 'utf8');
const tools = readFileSync(new URL('../lib/mcpTools.ts', import.meta.url), 'utf8');
const auth = readFileSync(new URL('../lib/apiKeyAuth.ts', import.meta.url), 'utf8');

test('401 responses advertise Bearer and revoked keys use that response', () => {
  assert.match(auth, /const REALM = 'Bearer realm="life-ascension"'/);
  assert.match(auth, /if \(result\.status === 401\) headers\['WWW-Authenticate'\] = REALM/);
  assert.match(auth, /'Cache-Control': 'no-store'/);
  assert.match(auth, /if \(!row \|\| !matches\) return unauthorized\('Invalid or revoked API key'\)/);
  assert.match(auth, /function unauthorized\(error: string\): AuthFailure \{\s*return \{ ok: false, status: 401, error \};/);
  assert.match(route, /return authenticationErrorResponse/);
  assert.match(route, /if \(!auth\.ok\) return authenticationErrorResponse\(auth\)/);
});

test('mcp tools use the scheduling and progress RPCs', () => {
  assert.match(route, /runMcpTool/);
  assert.match(route, /const fail = \(id: unknown, code: number, message: string\) => NextResponse\.json\(\{ jsonrpc: '2\.0', id, error: \{ code, message \} \}\)/);
  assert.match(route, /if \(!outcome\.ok\) return fail\(id, outcome\.rpcCode, outcome\.message\)/);
  assert.match(tools, /create_scheduled_quest_as_user/);
  assert.match(tools, /add_quest_progress_as_user/);
  assert.match(tools, /set_quest_instance_status_as_user/);
  assert.match(tools, /confirmed_complete !== true/);
  assert.match(tools, /\.eq\('owner_id', userId\)\.eq\('active', true\)/);
  assert.match(tools, /\.eq\('owner_id', userId\)\.in\('quest_id', activeIds\)/);
  assert.doesNotMatch(tools, /migration required/i);
  assert.doesNotMatch(tools, /\.from\('quests'\)\.insert/);
  assert.doesNotMatch(route, /from\('quests'\)\s*\.delete/);
});
