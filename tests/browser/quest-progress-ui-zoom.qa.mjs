/**
 * Browser-UI 200% zoom proof, deliberately separate from CDP pageScaleFactor.
 *
 * Run only against a local development-only fixture with no backend credentials:
 *   QA_BASE_URL=http://127.0.0.1:3128 CHROMIUM_BIN=/path/to/chrome \
 *     node tests/browser/quest-progress-ui-zoom.qa.mjs
 *
 * Chromium must actually honor Ctrl+= browser zoom and report BOTH a ~2x
 * devicePixelRatio and a ~halved CSS layout viewport. If headless Chromium
 * ignores the shortcut, this script FAILS CLOSED: do not report zoom PASS.
 * Requires unprivileged Chromium with its sandbox enabled.
 */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

if (typeof process.getuid === 'function' && process.getuid() === 0) {
  throw new Error('Browser zoom QA requires a non-root sandboxed runner.');
}
const { chromium } = await import('playwright');
const browser = await chromium.launch({
  headless: process.env.QA_HEADED !== '1',
  chromiumSandbox: true,
  ...(process.env.CHROMIUM_BIN ? { executablePath: process.env.CHROMIUM_BIN } : {}),
});
const output = 'artifacts/quest-progress';
await mkdir(output, { recursive: true });
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:3128';

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(base + '/qa/quest-progress');
  await page.getByRole('heading', { name: /Quest progress interaction QA/ }).waitFor();
  await page.locator('[data-qa-hydrated="true"]').waitFor();

  const metrics = () => page.evaluate(() => ({
    dpr: window.devicePixelRatio,
    width: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    scale: window.visualViewport?.scale ?? null,
  }));

  for (const width of [320, 375, 390, 430]) {
    await page.keyboard.press('Control+Digit0');
    await page.setViewportSize({ width, height: 844 });
    const before = await metrics();
    let after = before;
    for (let attempt = 0; attempt < 8; attempt++) {
      await page.keyboard.press('Control+Equal');
      await page.waitForTimeout(120);
      after = await metrics();
      if (after.dpr / before.dpr >= 1.95) break;
    }
    const dprRatio = after.dpr / before.dpr;
    const widthRatio = before.width / after.width;
    console.log('BROWSER_UI_ZOOM_EVIDENCE', JSON.stringify({ width, before, after, dprRatio, widthRatio }));
    assert.ok(dprRatio >= 1.95 && dprRatio <= 2.05,
      `Browser did not reach 200% UI zoom at ${width}px; DPR ratio=${dprRatio}. Headless shortcut may be unsupported.`);
    assert.ok(widthRatio >= 1.90 && widthRatio <= 2.10,
      `Layout viewport did not shrink at 200% UI zoom at ${width}px; ratio=${widthRatio}`);
    assert.ok(after.scrollWidth <= after.width + 1,
      `Horizontal overflow under genuine browser 200% zoom at ${width}px`);
    const add = page.getByRole('button', { name: /^Add 2 repetitions/ });
    await add.focus();
    assert.equal(await add.evaluate(el => document.activeElement === el), true,
      `Add focus lost under browser zoom at ${width}px`);
    await page.screenshot({ path: join(output, `quest-progress-ui-zoom200-${width}.png`), fullPage: true });
  }
  console.log('PASS: browser UI 200% zoom signal, layout shrink, no overflow and Add focus at all four widths.');
  console.log('This is local UI evidence only, NOT authenticated Preview, backend idempotency or production acceptance.');
} finally {
  await browser.close();
}
