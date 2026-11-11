import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createDelve, currentRoomChoices } from '../lib/crypt/delve/run.ts';
import { BOSS, FLOOR_ROWS, ROOM_LABEL, roomTitle } from '../lib/crypt/delve/floor.ts';
import { pathBadge, pathOptions, shortRoomLabel } from '../lib/crypt/delve/pathLabels.ts';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const runId = '00000000-0000-4000-a000-000000000007';
const ZERO = { strength: 0, agility: 0, intelligence: 0, endurance: 0, luck: 0 };

test('reachable map node labels match the option list on every row of many floors', () => {
  for (let seed = 1; seed <= 40; seed += 1) {
    const state = createDelve({ runId, seed, level: 1, allocated: ZERO });
    for (let row = 0; row <= FLOOR_ROWS; row += 1) {
      const view = { ...state, row };
      const boss = row >= FLOOR_ROWS;
      const rooms = currentRoomChoices(view);
      const options = pathOptions(rooms, boss);
      assert.equal(options.length, rooms.length);
      assert.ok(options.length >= 1 && options.length <= 3);
      const badges = options.map((option) => option.badge);
      assert.deepEqual(badges, ['A', 'B', 'C'].slice(0, rooms.length));
      options.forEach((option, index) => {
        const room = rooms[index];
        // The list button text is "<kind>: <title>"; the map node shows the short label for the same room.
        const listText = `${option.kind}: ${option.title}`;
        if (boss) assert.equal(listText, `Boss: ${BOSS.name}`);
        else assert.equal(listText, `${ROOM_LABEL[room.kind]}: ${roomTitle(room)}`);
        assert.equal(option.short, shortRoomLabel(room, boss));
        if (room.kind === 'fight' && !boss) assert.equal(option.short, roomTitle(room));
        if (room.kind === 'elite') assert.equal(option.short, `Elite: ${roomTitle(room)}`);
        if (room.kind === 'treasure') assert.equal(option.short, 'Chest');
        if (room.kind === 'event') assert.equal(option.short, 'Mystery');
        if (room.kind === 'rest') assert.equal(option.short, 'Campfire');
        assert.equal(option.ariaLabel, `Path ${option.badge}: ${option.kind}, ${option.title}`);
      });
    }
  }
});

test('two fights on one row get distinct badges and enemy-name labels', () => {
  const rooms = [{ kind: 'fight', foeId: 'grave-bat' }, { kind: 'fight', foeId: 'crypt-rat' }];
  const options = pathOptions(rooms);
  assert.equal(pathBadge(0), 'A');
  assert.equal(pathBadge(1), 'B');
  assert.equal(options[0].ariaLabel, `Path A: Fight, Grave Bat`);
  assert.equal(options[1].ariaLabel, `Path B: Fight, Crypt Rat`);
});

test('the map and the list render from the same pathOptions, and the map never enters a room', () => {
  const source = read('components/crypt/DelveRun.tsx');
  const map = source.slice(source.indexOf('function MapView('), source.indexOf('/* ---------- Combat ---------- */'));
  assert.match(map, /const options = pathOptions\(choices, boss\)/);
  assert.match(map, /aria-label=\{option\.ariaLabel\}/);
  assert.match(map, /data-path=\{option\.badge\}/);
  assert.match(map, /\{option\.short\}/);
  assert.equal((map.match(/onChoose\(/g) ?? []).length, 1, 'only the list button enters a room');
  assert.doesNotMatch(map, /setTimeout|setInterval|requestAnimationFrame/);
  const css = read('app/style.css');
  assert.match(css, /\.delve-node \{[^}]*min-width: 44px; min-height: 44px;/);
  assert.match(css, /\.delve-node-label \{[^}]*text-overflow: ellipsis; white-space: nowrap;/);
});
