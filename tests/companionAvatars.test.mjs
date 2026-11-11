import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('companion avatars are small cosmetic portraits with pixelated rendering and alt text', () => {
  for (const name of ['izzy', 'connor']) {
    for (const ext of ['png', 'webp']) {
      const file = statSync(new URL(`../public/avatars/${name}.${ext}`, import.meta.url));
      assert.ok(file.size > 1000 && file.size < 80_000, `${name}.${ext} is ${file.size} bytes`);
    }
  }
  const css = read('app/style.css');
  const avatar = read('components/PixelAvatar.tsx');
  const home = read('app/(app)/companion/CompanionHome.tsx');
  const page = read('app/(app)/companion/page.tsx');
  const board = read('app/(app)/quests/page.tsx');
  assert.match(css, /image-rendering:\s*pixelated/);
  assert.match(avatar, /alt=\{alt\}/);
  assert.match(page, /alt="Izzy, a pixel princess with a silver tiara"/);
  assert.match(page, /alt="Connor's hero, a pixel knight in silver armor"/);
  assert.match(home, /who="connor"/);
  assert.match(home, /Sunday recap/);
  assert.match(board, /alt="From Izzy"/);
  assert.doesNotMatch(read('components/crypt/DelveRun.tsx'), /\/avatars\/connor/);
});
