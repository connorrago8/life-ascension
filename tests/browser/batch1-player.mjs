/**
 * Local player walkthrough at 375x812. No hosted Supabase. Preview mode for Home and Quests.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const base = process.env.QA_BASE_URL || 'http://127.0.0.1:3456';
const out = process.env.BATCH1_ARTIFACTS || '/opt/cursor/artifacts/batch1';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_BIN || '/usr/local/bin/google-chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 375, height: 812 }, hasTouch: true });
const shots = [];
async function shot(name) {
  const path = `${out}/${name}.png`;
  await page.screenshot({ path, fullPage: true });
  shots.push(path);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  if (overflow) throw new Error(`${name} scrolls sideways at 375px`);
}

try {
  await page.goto(`${base}/?preview=1`);
  await page.getByRole('heading', { name: 'Adventurer' }).waitFor();
  const home = page.getByRole('link', { name: 'Home', exact: true });
  if (await home.getAttribute('aria-current') !== 'page') throw new Error('Home tab is not highlighted on Home');
  await shot('01-home');

  await page.goto(`${base}/quests?preview=1`);
  await page.getByText('Layout preview. Sign in to load your quests.').waitFor();
  if (await page.getByRole('link', { name: 'Quests', exact: true }).getAttribute('aria-current') !== 'page') throw new Error('Quests tab is not highlighted');
  if (await page.locator('.quest-title .streak-badge').count() < 1) throw new Error('per-quest streak badge missing');
  if (await page.getByText(/Complete this quest today to keep its streak/).count() !== 0) throw new Error('streak pressure copy is visible');
  if (await page.getByText(/Chicago time/).count() !== 0) throw new Error('Chicago time label is still visible');
  await shot('02-quests');

  await page.getByRole('link', { name: 'Hub', exact: true }).click();
  await page.getByRole('heading', { name: 'Hub', exact: true }).waitFor();
  if (await page.getByRole('link', { name: 'Hub', exact: true }).getAttribute('aria-current') !== 'page') throw new Error('Hub tab is not highlighted');
  await shot('03-hub');
  await page.getByRole('button', { name: 'Town, open Emberhaven', exact: true }).click();
  await page.waitForURL((url) => url.pathname === '/play/emberhaven');
  await page.getByRole('heading', { name: 'Emberhaven', exact: true }).waitFor();
  if (await page.getByRole('button', { name: /^Walk / }).count() !== 0) throw new Error('walking controls are visible');
  await page.getByText('A short town story. Find 3 clues, then put them in order.').waitFor();
  await shot('04-town');

  await page.getByRole('link', { name: 'Visit Hearth', exact: true }).click();
  await page.getByRole('heading', { name: 'The Hearth', exact: true }).waitFor();
  if (await page.getByRole('link', { name: /Back to Hub/ }).count() !== 0) throw new Error('Hearth back skips to the Hub');
  await page.getByRole('link', { name: '← Back to Town', exact: true }).click();
  await page.getByRole('heading', { name: 'Emberhaven', exact: true }).waitFor();
  await page.goBack();
  await page.getByRole('heading', { name: 'The Hearth', exact: true }).waitFor();
  await page.goBack();
  await page.getByRole('heading', { name: 'Emberhaven', exact: true }).waitFor();

  await page.getByRole('button', { name: 'Begin the Lantern Route', exact: true }).click();
  await page.getByText('0 of 3 clues found.').waitFor();
  await page.getByRole('link', { name: 'Visit Hearth', exact: true }).click();
  await page.getByRole('button', { name: 'Talk to Hearth keeper', exact: true }).click();
  await page.getByRole('button', { name: 'Ask about the Lantern Route', exact: true }).click();
  await page.getByText('1 of 3 found.').waitFor();
  await page.getByRole('link', { name: '← Back to Town', exact: true }).click();
  await page.getByText('1 of 3 clues found.').waitFor();
  await page.reload();
  await page.getByText('1 of 3 clues found.').waitFor();
  await shot('05-lantern-saved');

  await page.getByRole('link', { name: 'Hub', exact: true }).click();
  await page.getByRole('link', { name: 'Enter Brain Rot' }).click();
  await page.waitForURL((url) => url.pathname === '/play/brain-rot');
  await shot('06-brain-rot');
  console.log(JSON.stringify({ ok: true, shots }, null, 2));
} finally {
  await browser.close();
}
