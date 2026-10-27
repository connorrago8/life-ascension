/**
 * REAL-COMPONENT browser QA against the development-only /qa/quest-progress fixture.
 * Requires an unprivileged local runner, a running 'npm run dev' server and
 * Playwright+Chromium installed separately. No credentials or backend requests.
 *
 * Run: node tests/browser/quest-progress.qa.mjs
 * Output: artifacts/quest-progress/*.png (not automatically uploaded).
 */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

if (typeof process.getuid === 'function' && process.getuid() === 0) {
  throw new Error('Refusing to run Chromium as root. Use an unprivileged sandboxed user.');
}
let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  throw new Error('Playwright is not installed. Install it and Chromium in an isolated QA runner; no browser tests ran.');
}
const baseURL = process.env.QA_BASE_URL || 'http://127.0.0.1:3000';
const browser = await chromium.launch({
  headless: true,
  chromiumSandbox: true,
  ...(process.env.CHROMIUM_BIN ? { executablePath: process.env.CHROMIUM_BIN } : {}),
});
const output = 'artifacts/quest-progress';
await mkdir(output, { recursive: true });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(baseURL + '/qa/quest-progress');
  assert.equal(await page.getByRole('heading', { name: /Quest progress interaction QA/ }).count(), 1,
    'QA fixture must be running under Next development mode');
  await page.locator('[data-qa-hydrated="true"]').waitFor();
  await page.getByRole('button', { name: /Clear QA journal/ }).click();
  await page.locator('[data-qa-hydrated="true"]').waitFor();
  // CEO P1: verify a real Tab sequence and visible keyboard focus at phone widths.
  // This uses the actual component, not a static markup assertion.
  const addButton = page.getByRole('button', { name: /^Add 2 repetitions/ });
  const undoButton = page.getByRole('button', { name: /Undo 2 repetitions/ });
  for (const width of [320, 375, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await page.getByLabel('Mock next response (no network)').focus();
    for (const [target, label] of [[addButton, 'Add'], [undoButton, 'Undo']]) {
      await page.keyboard.press('Tab');
      const focus = await target.evaluate(element => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return {
          active: document.activeElement === element,
          focusVisible: element.matches(':focus-visible'),
          outlineVisible: style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0,
          withinViewport: rect.left >= 0 && rect.right <= innerWidth + 1,
        };
      });
      assert.equal(focus.active, true, `${label} must receive keyboard Tab focus at ${width}px`);
      assert.equal(focus.focusVisible && focus.outlineVisible, true,
        `${label} must show a visible keyboard focus outline at ${width}px`);
      assert.equal(focus.withinViewport, true, `${label} focus must remain within ${width}px viewport`);
      if (label === 'Add') {
        await page.screenshot({ path: join(output, `quest-progress-keyboard-${width}.png`), fullPage: true });
      }
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false,
      `Keyboard focus must not cause horizontal overflow at ${width}px`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  console.log('PASS: real Tab focus, visible Add/Undo outlines and no overflow at 320/375/390/430px.');
  await addButton.click();
  await page.getByText('Save not confirmed. Retry the same operation before logging more.').waitFor();
  const pending = await page.evaluate(() => localStorage.getItem('life-progress-pending:qa-local-progress-only'));
  assert.ok(pending, 'Pending journal must survive an unconfirmed mock response');
  const original = JSON.parse(pending);
  assert.equal(original.delta, 2);
  await page.reload();
  await page.locator('[data-qa-hydrated="true"]').waitFor();
  await page.getByRole('button', { name: /Retry saving progress/ }).waitFor();
  await page.getByLabel('Mock next response (no network)').selectOption('saved');
  // Keyboard-only Retry must preserve the original operation ID and delta.
  const retryButton = page.getByRole('button', { name: /Retry saving progress/ });
  await page.getByLabel('Mock next response (no network)').focus();
  await page.keyboard.press('Tab');
  assert.equal(await retryButton.evaluate(element =>
    document.activeElement === element && element.matches(':focus-visible')), true,
    'Retry must be reachable with Tab and show keyboard focus');
  await page.keyboard.press('Enter');
  await page.getByText('Progress saved.').waitFor();
  const retryLog = await page.locator('[data-testid="qa-operation-log"]').innerText();
  assert.ok(retryLog.includes(`|${original.id}|2|saved`), 'Retry must reuse original operation ID and delta');
  assert.equal(await page.evaluate(() => localStorage.getItem('life-progress-pending:qa-local-progress-only')), null);
  await page.getByRole('button', { name: /Clear QA journal/ }).click();
  await page.locator('[data-qa-hydrated="true"]').waitFor();
  await page.getByLabel('Mock next response (no network)').selectOption('saved');
  await page.getByRole('button', { name: /Undo 2 repetitions/ }).click();
  // Preserve real-browser evidence even when Undo does not confirm; never claim a pass by timeout.
  console.log('UNDO QA STATE:', JSON.stringify({
    selectedMock: await page.getByLabel('Mock next response (no network)').inputValue(),
    operations: await page.locator('[data-testid="qa-operation-log"]').innerText(),
    alerts: await page.getByRole('alert').allInnerTexts(),
    statuses: await page.getByRole('status').allInnerTexts(),
  }));
  await page.screenshot({ path: join(output, 'quest-progress-undo-diagnostic.png'), fullPage: true });
  await page.getByText('Progress saved.').waitFor();
  assert.match(await page.locator('[data-testid="qa-operation-log"]').innerText(), /\|-2\|saved/);
  await page.getByRole('button', { name: /Seed malformed journal/ }).click();
  await page.getByRole('alert').filter({ hasText: /pending save record is unreadable/ }).waitFor();
  assert.equal(await page.getByRole('button', { name: /^Add 2 repetitions/ }).isDisabled(), true);
  for (const width of [320, 375, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    assert.equal(overflow, false, `Unexpected horizontal overflow at ${width}px`);
    await page.screenshot({ path: join(output, `quest-progress-${width}.png`), fullPage: true });
  }
  console.log('PASS: real-component refresh, original-ID retry, Undo, corrupt journal, four viewport widths.');
  console.log('Not covered: real backend idempotency, authenticated Preview, or true browser 200% zoom.');
} finally {
  await browser.close();
}
