import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../app/qa/quest-progress/page.tsx', import.meta.url), 'utf8');
const harness = readFileSync(new URL('../app/qa/quest-progress/QuestProgressQAHarness.tsx', import.meta.url), 'utf8');
const browser = readFileSync(new URL('./browser/quest-progress.qa.mjs', import.meta.url), 'utf8');

test('real-component QA route is development-only and uses no backend', () => {
  assert.match(page, /process\.env\.NODE_ENV !== 'development'\) notFound\(\)/);
  assert.match(page, /<QuestProgressQAHarness\s*\/>/);
  assert.match(harness, /<QuestProgressControls/);
  assert.doesNotMatch(page + harness, /from ['\"][^'\"]*supabase|fetch\(|createClient\(|awardXp|xp_awarded/i);
});

test('QA harness exposes retry, rejected, saved, corrupt and Clear flows', () => {
  assert.match(harness, /'saved' \| 'retry' \| 'rejected'/);
  assert.match(harness, /Seed malformed journal and reload/);
  assert.match(harness, /life-progress-pending:/);
  assert.match(harness, /confirmed\.current\.has\(requestId\)/);
  assert.match(browser, /original\.id/);
  assert.match(browser, /Clear progress for/);
  assert.match(browser, /pending save record is unreadable/);
});

test('browser script refuses unsandboxed root capture and covers phone widths', () => {
  assert.match(browser, /process\.getuid\(\) === 0/);
  assert.match(browser, /chromiumSandbox: true/);
  assert.match(browser, /\[320, 375, 390, 430\]/);
  assert.match(browser, /document\.documentElement\.scrollWidth > innerWidth/);
});
