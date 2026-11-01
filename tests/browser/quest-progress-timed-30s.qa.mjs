/** Local-only timed Quest Progress Save/Retry browser acceptance. No Supabase or XP. */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

if (typeof process.getuid === 'function' && process.getuid() === 0) throw new Error('Run as unprivileged user');
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:3128';
const browser = await chromium.launch({ headless: true, chromiumSandbox: true,
  ...(process.env.CHROMIUM_BIN ? { executablePath: process.env.CHROMIUM_BIN } : {}) });
await mkdir('artifacts/quest-progress', { recursive: true });
try {
  const context = await browser.newContext({ viewport: { width: 320, height: 760 } });
  const page = await context.newPage();
  await page.goto(base + '/qa/quest-progress');
  await page.locator('[data-qa-hydrated="true"]').waitFor();
  await page.getByRole('button', { name: /Clear QA journal and reload/ }).click();
  await page.locator('[data-qa-hydrated="true"]').waitFor();
  const start = performance.now();
  let actions = 0;
  const add = page.getByRole('button', { name: /Add 2 repetitions/ });
  await add.focus();
  assert.equal(await add.evaluate(el => document.activeElement === el), true);
  await add.press('Enter'); actions++;
  await page.getByRole('button', { name: /Retry saving progress/ }).waitFor();
  const first = await page.evaluate(() => JSON.parse(localStorage.getItem('life-progress-pending:qa-local-progress-only')));
  assert.equal(first.delta, 2);
  assert.ok(first.id);
  await page.reload();
  await page.locator('[data-qa-hydrated="true"]').waitFor();
  const pending = await page.evaluate(() => JSON.parse(localStorage.getItem('life-progress-pending:qa-local-progress-only')));
  assert.deepEqual(pending, first, 'refresh must preserve original operation ID and delta');
  await page.locator('#qa-response').selectOption('saved'); actions++;
  const retry = page.getByRole('button', { name: /Retry saving progress/ });
  await retry.focus();
  assert.equal(await retry.evaluate(el => document.activeElement === el), true);
  await retry.press('Enter'); actions++;
  await page.getByText('Progress saved.', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem('life-progress-pending:qa-local-progress-only')), null);
  const log = await page.getByTestId('qa-operation-log').innerText();
  assert.ok(log.includes(first.id + '|2|saved'), 'retry must use same ID and delta');
  const metrics = await page.evaluate(() => ({ innerWidth, scrollWidth: document.documentElement.scrollWidth,
    active: document.activeElement?.getAttribute('aria-label') ?? null }));
  assert.ok(metrics.scrollWidth <= metrics.innerWidth + 1, 'no horizontal overflow at 320 CSS px');
  const elapsedMs = Math.round(performance.now() - start);
  await page.screenshot({ path: 'artifacts/quest-progress/quest-save-retry-timed-320.png', fullPage: true });
  console.log('QUEST_30_SECOND_EVIDENCE', JSON.stringify({ elapsedMs, actions, width: 320, requestId: first.id, metrics }));
  assert.ok(elapsedMs <= 30000, 'local mock Save/Retry exceeded 30 seconds');
  console.log('PASS local timed 320px Quest Progress Save/Retry; NOT a native 200% zoom or hosted XP test');
} finally { await browser.close(); }
