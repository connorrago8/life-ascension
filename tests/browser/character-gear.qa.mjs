/**
 * Real CharacterScreen browser acceptance on an unprivileged local Chromium.
 * Uses a development-only synthetic ownership/equip fixture, NOT Supabase.
 * Does not prove authenticated database persistence or iPhone Safari behavior.
 */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

if (typeof process.getuid === 'function' && process.getuid() === 0) {
  throw new Error('Refusing to run Chromium as root.');
}
let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  throw new Error('Playwright required in isolated browser QA runner.');
}
const output = 'artifacts/character-gear';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  chromiumSandbox: true,
  ...(process.env.CHROMIUM_BIN ? { executablePath: process.env.CHROMIUM_BIN } : {}),
});
const baseURL = process.env.QA_BASE_URL || 'http://127.0.0.1:3000';

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const accountWrites = [];
  page.on('request', request => {
    if (request.method() !== 'GET' &&
        /supabase\.co|\/api\/(?:quests?|progress|xp|equipment|inventory)/i.test(request.url())) {
      accountWrites.push(request.method() + ' ' + request.url());
    }
  });
  await page.goto(baseURL + '/qa/character-gear');
  await page.getByRole('heading', { name: /Character gear interaction QA/ }).waitFor();
  await page.locator('[data-qa-hydrated="true"]').waitFor();
  await page.getByRole('button', { name: 'Reset mock ownership' }).click();

  const avatar = page.locator('svg[data-character-style="home"]');
  await avatar.waitFor();
  const imageLabel = () => avatar.getAttribute('aria-label');
  const headwearSlot = () => page.getByRole('button', { name: /^Headwear: .*Choose equipment$/ });
  const sheet = () => page.getByRole('dialog', { name: /^Choose headwear$/ });
  async function chooseInSheet(name) {
    await headwearSlot().click();
    await sheet().waitFor();
    await page.getByRole('button', { name, exact: true }).click();
    await sheet().waitFor({ state: 'detached' });
  }
  assert.doesNotMatch(await imageLabel(), /Ashen Hood/i);
  assert.equal(await headwearSlot().count(), 0, 'Unverified character must not offer equipment writes');

  await page.getByRole('button', { name: 'Mock server: invalid unowned equip' }).click();
  assert.equal(await headwearSlot().count(), 0, 'Equipped-but-unowned mock must fail closed');
  assert.doesNotMatch(await imageLabel(), /Ashen Hood/i);

  await page.getByRole('button', { name: 'Mock server: grant Ashen Hood' }).click();
  await headwearSlot().waitFor();
  assert.doesNotMatch(await imageLabel(), /Ashen Hood/i, 'Ownership alone must not draw armor before equip');

  // Locked slots show the unlock level and are not tappable at Lv 3.
  for (const [label, level] of [['Shield', 5], ['Cloak', 10], ['Companion', 15]]) {
    await page.getByRole('group', { name: `${label}: locked. Unlocks at Lv ${level}` }).waitFor();
    assert.equal(await page.getByRole('button', { name: new RegExp(`^${label}: `) }).count(), 0, `${label} locked`);
  }
  // Unlocked slot with nothing owned shows the empty state; Escape returns focus to the slot.
  const weaponSlot = page.getByRole('button', { name: /^Weapon: .*Choose equipment$/ });
  await weaponSlot.click();
  await page.getByRole('dialog', { name: 'Choose weapon' }).getByText('No items for this slot yet').waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  assert.equal(await weaponSlot.evaluate((node) => node === document.activeElement), true, 'focus returns to slot');

  await headwearSlot().click();
  await sheet().getByText('Ashen Hood').waitFor();
  await page.screenshot({ path: join(output, 'headwear-sheet-390.png'), fullPage: true });
  await page.getByRole('button', { name: 'Equip Ashen Hood', exact: true }).click();
  await sheet().waitFor({ state: 'detached' });
  await page.getByRole('button', { name: 'Headwear: Ashen Hood. Choose equipment' }).waitFor();
  assert.match(await imageLabel(), /Ashen Hood/i, 'Confirmed equip must change the actual character SVG');
  await page.screenshot({ path: join(output, 'earned-hood-equipped-390.png'), fullPage: true });

  await page.reload();
  await page.locator('[data-qa-hydrated="true"]').waitFor();
  await page.getByRole('button', { name: 'Headwear: Ashen Hood. Choose equipment' }).waitFor();
  assert.match(await imageLabel(), /Ashen Hood/i, 'Reload must rehydrate the synthetic confirmed equipment snapshot');

  await chooseInSheet('Unequip Ashen Hood');
  await page.getByRole('button', { name: 'Headwear: Empty. Choose equipment' }).waitFor();
  assert.doesNotMatch(await imageLabel(), /Ashen Hood/i, 'Unequip must remove the visible hood');
  await page.reload();
  await page.locator('[data-qa-hydrated="true"]').waitFor();
  await page.getByRole('button', { name: 'Headwear: Empty. Choose equipment' }).waitFor();
  assert.doesNotMatch(await imageLabel(), /Ashen Hood/i, 'Reload must preserve synthetic unequipped state');

  // Below Lv 3 headwear is locked even though the hood is owned.
  await page.getByRole('button', { name: 'Mock server: level 2' }).click();
  await page.getByRole('group', { name: 'Headwear: locked. Unlocks at Lv 3' }).waitFor();
  assert.equal(await headwearSlot().count(), 0, 'locked headwear is not tappable');
  await page.getByRole('button', { name: 'Mock server: level 3' }).click();
  await headwearSlot().waitFor();

  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false,
      `Character equipment must not overflow the ${width}px viewport`);
    await page.screenshot({ path: join(output, `owned-unequipped-${width}.png`), fullPage: true });
  }
  assert.deepEqual(accountWrites, [], 'Local Character fixture must never write account data');
  console.log('PASS: real Chromium CharacterScreen unowned denial → earned → slot sheet equip/visible hood →');
  console.log('locked slots + empty slot sheet → refresh persistence → sheet unequip → Lv2 headwear lock, 320/390px, zero account writes.');
  console.log('NOT covered: real auth, server RPCs, hosted QA, physical iPhone or database persistence.');
} finally {
  await browser.close();
}
