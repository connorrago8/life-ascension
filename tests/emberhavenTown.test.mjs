import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../app/(app)/play/emberhaven/page.tsx', import.meta.url), 'utf8');

test('Emberhaven connects to existing quest, character, and adventure routes', () => {
  for (const route of ['/quests', '/play/emberhaven/blacksmith', '/play/emberhaven/hearth', '/play/emberhaven/market', '/play/emberhaven/waystone', '/play']) {
    assert.match(source, new RegExp(`href: '${route.replaceAll('/', '\\/')}'`));
  }
});

test('Emberhaven has six unique destinations and does not promise a live shop', () => {
  for (const title of ['The Noticeboard', 'The Blacksmith', 'The Hearth', 'The Lantern Market', 'The Waystone', 'The Trail Gate']) {
    assert.equal(source.split(`name: '${title}'`).length - 1, 1);
  }
  assert.match(source, /No shop, crafting, or rewards are active here/);
});

test('Emberhaven is navigation-only with no account or run mutations', () => {
  assert.doesNotMatch(source, /supabase\(|\.rpc\(|localStorage\.|sessionStorage\.|fetch\(|router\.push\(/);
});

test('Emberhaven exposes landmarks and respects mobile safe areas', () => {
  assert.match(source, /aria-labelledby="emberhaven-title"/);
  assert.match(source, /aria-label="Town destinations"/);
  assert.match(source, /safe-area-inset-bottom/);
  assert.match(source, /minHeight: 44/);
});

const forge = readFileSync(new URL('../app/(app)/play/emberhaven/blacksmith/page.tsx', import.meta.url), 'utf8');

test('Blacksmith makes no false account-inventory promises', () => {
  assert.match(forge, /demonstration content, not verified account inventory/);
  assert.match(forge, /href="\/character"/);
  assert.match(forge, /href="\/play\/emberhaven"/);
  assert.doesNotMatch(forge, /supabase\(|\.rpc\(|localStorage\.|sessionStorage\.|fetch\(/);
});

test('Town adventure gate does not assert Crypt unlock state', () => {
  assert.match(source, /Crypt availability depends on the deployed game version/);
  assert.match(source, /No shop, crafting, or rewards are active here/);
});

const hub = readFileSync(new URL('../components/play/AdventureHub.tsx', import.meta.url), 'utf8');

test('Playable AdventureHub links to Emberhaven without changing Crypt entry', () => {
  assert.match(hub, /href="\/play\/emberhaven"/);
  assert.match(hub, /CRYPT_ENTRY_HREF = '\/play\/delve'/);
  assert.match(hub, /ACTIVE_RUN_KEY/);
  assert.doesNotMatch(source, /ACTIVE_RUN_KEY|clearActiveRun|saveActiveRun/);
});

for (const [slug, title] of [['hearth', 'The Hearth'], ['market', 'The Lantern Market'], ['waystone', 'The Waystone']]) {
  test(`${title} is reachable and has a safe return route`, () => {
    const room = readFileSync(new URL(`../app/(app)/play/emberhaven/${slug}/page.tsx`, import.meta.url), 'utf8');
    assert.match(room, new RegExp(`href="/play/emberhaven"`));
    assert.match(room, /safe-area-inset-bottom/);
    assert.match(room, /minHeight: 44/);
    assert.doesNotMatch(room, /supabase\(|\.rpc\(|localStorage\.|sessionStorage\.|fetch\(|clearActiveRun\(/);
  });
}

test('Waystone directs the player to the existing map, never bypasses Crypt run handling', () => {
  const room = readFileSync(new URL('../app/(app)/play/emberhaven/waystone/page.tsx', import.meta.url), 'utf8');
  assert.match(room, /href="\/play"/);
  assert.doesNotMatch(room, /href="\/play\/delve"/);
});

const map = readFileSync(new URL('../app/(app)/play/emberhaven/EmberhavenMap.tsx', import.meta.url), 'utf8');

test('Interactive town map offers all six landmarks and accessible selection', () => {
  assert.match(source, /<EmberhavenMap \/>/);
  for (const name of ['Noticeboard', 'Blacksmith', 'Hearth', 'Market', 'Waystone', 'Trail Gate']) {
    assert.match(map, new RegExp(`label: '${name}'`));
  }
  assert.match(map, /aria-pressed/);
  assert.match(map, /aria-live="polite"/);
  assert.match(map, /type="button"/);
  assert.match(map, /minHeight: 44/);
});

test('Town map uses existing navigation without changing account or active run state', () => {
  assert.match(map, /href: '\/play'/);
  assert.match(map, /href: '\/quests'/);
  assert.doesNotMatch(map, /supabase\(|\.rpc\(|localStorage\.|sessionStorage\.|fetch\(|clearActiveRun\(|saveActiveRun\(/);
});

test('Town walking has movement controls and keyboard support', () => {
  assert.match(map, /setPosition/);
  assert.match(map, /onKeyDown/);
  assert.match(map, /Walk north/);
  assert.match(map, /Walk south/);
  assert.match(map, /Walk east/);
  assert.match(map, /Walk west/);
});

test('Town exploration includes directional feedback and local proximity cues', () => {
  assert.match(map, /setSteps/);
  assert.match(map, /data-facing/);
  assert.match(map, /atSelected/);
  assert.match(map, /You are at this landmark/);
});

test('Town walking counts actual movement without nested state updates', () => {
  assert.match(map, /next !== position/);
  assert.match(map, /setSteps/);
  assert.doesNotMatch(map, /setPosition\(\(old\) =>/);
});

test('Town map includes obstacles and inspect dialogue', () => {
  assert.match(map, /TOWN_OBSTACLES/);
  assert.match(map, /walkTown/);
  assert.match(map, /aria-expanded/);
  assert.match(map, /Talk \/ inspect/);
});
