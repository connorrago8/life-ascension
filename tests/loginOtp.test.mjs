import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const login = readFileSync(new URL('../app/login/page.tsx', import.meta.url), 'utf8');
const callback = readFileSync(new URL('../app/auth/callback/route.ts', import.meta.url), 'utf8');
const board = readFileSync(new URL('../app/(app)/page.tsx', import.meta.url), 'utf8');
const whoami = readFileSync(new URL('../app/api/whoami/route.ts', import.meta.url), 'utf8');
const mcp = readFileSync(new URL('../app/api/mcp/route.ts', import.meta.url), 'utf8');
const auth = readFileSync(new URL('../lib/apiKeyAuth.ts', import.meta.url), 'utf8');

test('OTP verify flow is a six-digit email code and does not enumerate accounts', () => {
  assert.match(login, /verifyOtp\(\{ email: email\.trim\(\), token: code, type: 'email' \}\)/);
  assert.match(login, /shouldCreateUser: false/);
  assert.match(login, /If an account exists for this email, a 6-digit code was sent\./);
  assert.match(login, /That code is invalid or expired\. Request a new code and try again\./);
  assert.match(login, /Too many requests, wait a minute\./);
  assert.match(login, /\/rate limit\|too many requests\/i\.test\(error\.message\)/);
  assert.doesNotMatch(login, /setMessage\(error/);
  assert.doesNotMatch(login, /user not found|already registered/i);
});

test('an already signed-in user leaves /login for the safe return path', () => {
  assert.match(login, /if \(active && user\) router\.replace\(returnPath\(\)\)/);
  assert.match(login, /if \(active && session\?\.user\) router\.replace\(returnPath\(\)\)/);
  assert.match(login, /function returnPath\(\)/);
  assert.match(login, /safeNext\(new URLSearchParams\(window\.location\.search\)\.get\('next'\), window\.location\.origin\)/);
});

test('callback and auth-gated links use safeNext or a fixed same-origin next', () => {
  assert.match(callback, /requestOrigin\(request\)/);
  assert.match(callback, /safeNext\(url\.searchParams\.get\('next'\), origin\)/);
  assert.match(callback, /safeNext\(next, origin\)/);
  assert.match(callback, /\/login\?next=\$\{encodeURIComponent\(destination\)\}/);
  assert.match(board, /href=\{loginHref\}/);
  assert.match(board, /setLoginHref\('\/login\?next='\+encodeURIComponent\(next\|\|'\/'\)\)/);
  assert.match(board, /Quest notes/);
  assert.match(board, /API keys/);
  assert.match(board, /Upcoming/);
});

test('mcp and whoami still advertise Bearer on 401', () => {
  assert.match(whoami, /authenticationErrorResponse\(auth\)/);
  assert.match(mcp, /if \(!auth\.ok\) return authenticationErrorResponse\(auth\)/);
  assert.match(auth, /const REALM = 'Bearer realm="life-ascension"'/);
  assert.match(auth, /if \(result\.status === 401\) headers\['WWW-Authenticate'\] = REALM/);
  assert.match(auth, /if \(!row \|\| !matches\) return unauthorized\('Invalid or revoked API key'\)/);
});
