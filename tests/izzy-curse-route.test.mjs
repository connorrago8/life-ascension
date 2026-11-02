import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const route = readFileSync(new URL('../app/api/izzy/curses/route.ts', import.meta.url), 'utf8');

test('curse endpoint verifies signed-in user rather than trusting a client owner ID', () => {
  assert.match(route, /auth\.getUser\(\)/);
  assert.match(route, /p_owner_id: data\.user\.id/);
  assert.doesNotMatch(route, /p_owner_id:\s*(?:body|params|url|request)/);
});

test('service key remains server-only and endpoint disables response caching', () => {
  assert.match(route, /process\.env\.SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(route, /NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(route, /Cache-Control': 'no-store'/);
});

test('unauthorized and sealed curses do not return consequence text', () => {
  assert.match(route, /status: 401/);
  assert.match(route, /curse: null/);
  assert.match(route, /if \(!curse\)/);
});
