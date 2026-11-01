import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { emailAuthRedirect } from '../lib/emailAuthRedirect.ts';
import { requestOrigin } from '../lib/requestOrigin.ts';

const login = readFileSync(new URL('../app/login/page.tsx', import.meta.url), 'utf8');
const forgot = readFileSync(new URL('../app/login/forgot/page.tsx', import.meta.url), 'utf8');
const password = readFileSync(new URL('../app/settings/password/page.tsx', import.meta.url), 'utf8');
const board = readFileSync(new URL('../app/(app)/quests/page.tsx', import.meta.url), 'utf8');
const middleware = readFileSync(new URL('../middleware.ts', import.meta.url), 'utf8');
const server = readFileSync(new URL('../lib/supabaseServer.ts', import.meta.url), 'utf8');
const browser = readFileSync(new URL('../lib/supabase.ts', import.meta.url), 'utf8');

test('email links use the calling origin, including a Vercel preview', () => {
  const preview = 'https://life-ascension-git-feature-password-login.vercel.app';
  const url = emailAuthRedirect(preview, '/settings/password');
  assert.equal(url, `${preview}/auth/callback?next=${encodeURIComponent('/settings/password')}`);
  assert.equal(url.includes('https://life-ascension.vercel.app/'), false);
});

test('request origin prefers the forwarded host and rejects a spoofed host', () => {
  const preview = requestOrigin({
    headers: { get: (name) => ({ 'x-forwarded-host': 'preview.vercel.app', 'x-forwarded-proto': 'https' }[name] ?? null) },
    nextUrl: { origin: 'https://life-ascension.vercel.app' },
  });
  assert.equal(preview, 'https://preview.vercel.app');

  const fallback = requestOrigin({
    headers: { get: (name) => ({ 'x-forwarded-host': 'evil.com\nextra', 'x-forwarded-proto': 'https' }[name] ?? null) },
    nextUrl: { origin: 'https://life-ascension.vercel.app' },
  });
  assert.equal(fallback, 'https://life-ascension.vercel.app');

  const slashHost = requestOrigin({
    headers: { get: (name) => ({ 'x-forwarded-host': 'https://evil.com', 'x-forwarded-proto': 'https' }[name] ?? null) },
    nextUrl: { origin: 'https://life-ascension.vercel.app' },
  });
  assert.equal(slashHost, 'https://life-ascension.vercel.app');

  const badProto = requestOrigin({
    headers: { get: (name) => ({ 'x-forwarded-host': 'preview.vercel.app', 'x-forwarded-proto': 'javascript' }[name] ?? null) },
    nextUrl: { origin: 'http://localhost:3000' },
  });
  assert.equal(badProto, 'http://localhost:3000');
});

test('login is a password form and keeps the magic-link option', () => {
  assert.match(login, /signInWithPassword\(\{ email: email\.trim\(\), password \}\)/);
  assert.match(login, /method="post"/);
  assert.match(login, /name="email"/);
  assert.match(login, /type="email"/);
  assert.match(login, /autoComplete="username"/);
  assert.match(login, /type="password"/);
  assert.match(login, /autoComplete="current-password"/);
  assert.match(login, /<button className="btn" type="submit"/);
  assert.match(login, /<label htmlFor="email">Email<\/label>/);
  assert.match(login, /<label htmlFor="password">Password<\/label>/);
  assert.match(login, /Email me a link instead/);
  assert.match(login, /emailAuthRedirect\(window\.location\.origin, returnPath\(\)\)/);
  assert.match(login, /Forgot password\?/);
  assert.match(login, /Email or password is incorrect\./);
  assert.doesNotMatch(login, /setMessage\(error/);
  assert.doesNotMatch(login, /user not found|already registered/i);
  assert.doesNotMatch(login, /autoComplete="new-password"/);
});

test('forgot password redirects to the set-password page on this origin', () => {
  assert.match(forgot, /resetPasswordForEmail\(email\.trim\(\)/);
  assert.match(forgot, /redirectTo: emailAuthRedirect\(window\.location\.origin, '\/settings\/password'\)/);
  assert.match(forgot, /method="post"/);
  assert.match(forgot, /name="email"/);
  assert.match(forgot, /type="submit"/);
  assert.match(forgot, /If an account exists for this email, a password reset link was sent\./);
  assert.doesNotMatch(forgot, /setMessage\(error/);
  assert.doesNotMatch(forgot, /user not found|already registered/i);
});

test('signed-in users can set a password of at least 8 characters', () => {
  assert.match(password, /updateUser\(\{ password \}\)/);
  assert.match(password, /method="post"/);
  assert.match(password, /name="email"/);
  assert.match(password, /autoComplete="username"/);
  assert.match(password, /autoComplete="new-password"/);
  assert.match(password, /<label htmlFor="password">New password<\/label>/);
  assert.match(password, /<label htmlFor="confirm-password">Confirm password<\/label>/);
  assert.match(password, /type="submit"/);
  assert.match(password, /password\.length < 8/);
  assert.match(password, /Password must be at least 8 characters\./);
  assert.match(password, /Passwords do not match\./);
  assert.match(password, /Password saved\. You can sign in with your email and this password next time\./);
  assert.match(password, /Could not save the password\. Try again\./);
  assert.doesNotMatch(password, /setMessage\(error/);
});

test('the quest board links to set or change password beside quest notes and API keys', () => {
  assert.match(board, /Quest notes/);
  assert.match(board, /API keys/);
  assert.match(board, /href="\/settings\/password">Set or change password/);
});

test('middleware refreshes the cookie session and does not disable persistence', () => {
  assert.match(middleware, /refreshSession\(request\)/);
  assert.match(server, /export async function refreshSession/);
  assert.match(server, /await client\.auth\.getUser\(\)/);
  assert.match(server, /response\.cookies\.set\(name, value, options\)/);
  assert.match(server, /next-router-prefetch/);
  assert.match(browser, /createBrowserClient/);
  assert.doesNotMatch(browser, /persistSession:\s*false/);
  assert.doesNotMatch(server, /persistSession:\s*false/);
});
