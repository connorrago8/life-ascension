import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  SAMPLE_APPEARANCE,
  TRAVELERS_HOOD,
  WALKING_STAFF,
  WAYFARER_LANTERN,
  itemIds,
  recolorAppearance,
  swapMainHand,
  withEquippedItem,
} from '../lib/preview/appearance.ts';
import {
  adventureCharacterModel,
  homeCharacterModel,
} from '../lib/preview/characterRender.ts';
import { SPRITE_HEIGHT, SPRITE_WIDTH } from '../components/spriteArt.ts';
import {
  effectsForItems,
  gameplayBonuses,
} from '../lib/preview/equipmentEffects.ts';
import {
  MAIN_HAND_STORAGE_KEY,
  TITLE_SCREEN_BEHAVIOR,
  TITLE_SEEN_KEY,
  TITLE_SKIP_SETTING_TODO,
} from '../lib/preview/previewSession.ts';
import { SAMPLE_PROGRESSION, levelTitle, xpLabel } from '../lib/preview/progression.ts';
import { SAMPLE_QUESTS } from '../lib/preview/sampleQuests.ts';

const root = new URL('..', import.meta.url);

function read(path) {
  return readFileSync(new URL(path, root), 'utf8');
}

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) files.push(...walk(path));
    else if (/\.(ts|tsx|css)$/.test(entry)) files.push(path);
  }
  return files;
}

const previewDirs = ['app/preview', 'components/preview', 'lib/preview'].map((dir) => join(root.pathname, dir));
const previewFiles = previewDirs.flatMap((dir) => walk(dir));
const previewSource = previewFiles.map((file) => readFileSync(file, 'utf8')).join('\n');
const appearanceSource = read('lib/preview/appearance.ts');
const progressionSource = read('lib/preview/progression.ts');
const effectsSource = read('lib/preview/equipmentEffects.ts');
const renderSource = read('lib/preview/characterRender.ts');
const titleSource = read('components/preview/TitleScreen.tsx');
const homeSource = read('components/preview/HomeScreen.tsx');
const homeArtSource = read('components/preview/HomeCharacter.tsx');
const adventureSource = read('components/preview/AdventureScreen.tsx');
const adventureArtSource = read('components/preview/AdventureCharacter.tsx');
const navSource = read('components/preview/PreviewNav.tsx');
const frameSource = read('components/preview/PreviewFrame.tsx');
const middleware = read('middleware.ts');

test('changing appearance leaves progression and effects unchanged', () => {
  const progression = structuredClone(SAMPLE_PROGRESSION);
  const beforeIds = itemIds(SAMPLE_APPEARANCE);
  const effectsBefore = effectsForItems(beforeIds);

  const recolored = recolorAppearance(SAMPLE_APPEARANCE, {
    hair: '#112233',
    hairHighlight: '#AABBCC',
    skin: '#445566',
    skinShadow: '#223344',
    eye: '#00FFAA',
    tunic: '#654321',
    tunicLight: '#987654',
    trousers: '#010101',
    trousersLight: '#222222',
    boots: '#333333',
    bootsLight: '#444444',
    belt: '#555555',
  });

  assert.equal(recolored.hair, '#112233');
  assert.deepEqual(recolored.equipment, SAMPLE_APPEARANCE.equipment);
  assert.deepEqual(itemIds(recolored), beforeIds);
  assert.deepEqual(SAMPLE_PROGRESSION, progression);
  assert.deepEqual(effectsForItems(itemIds(recolored)), effectsBefore);
  assert.deepEqual(gameplayBonuses(effectsForItems(itemIds(recolored))), gameplayBonuses(effectsBefore));
  assert.equal(homeCharacterModel(recolored).strength, undefined);
  assert.equal(adventureCharacterModel(recolored).bonuses, undefined);

  assert.doesNotMatch(appearanceSource, /equipmentEffects|progression|strength|agility|intelligence|endurance|luck/);
  assert.doesNotMatch(progressionSource, /appearance|equipmentEffects/);
  assert.doesNotMatch(effectsSource, /appearance|progression|hair|skin/);
  assert.doesNotMatch(renderSource, /equipmentEffects|progression|strength|agility|luck|bonus/i);
});

test('swapping an equipped item updates both renders and bonuses come only from effects', () => {
  const before = SAMPLE_APPEARANCE;
  const after = swapMainHand(before);
  assert.equal(before.equipment.find((item) => item.slot === 'main-hand')?.id, WALKING_STAFF.id);
  assert.equal(after.equipment.find((item) => item.slot === 'main-hand')?.id, WAYFARER_LANTERN.id);

  const homeBefore = homeCharacterModel(before);
  const homeAfter = homeCharacterModel(after);
  const adventureBefore = adventureCharacterModel(before);
  const adventureAfter = adventureCharacterModel(after);

  assert.equal(homeBefore.mainHand, 'staff');
  assert.equal(homeAfter.mainHand, 'lantern');
  assert.equal(adventureBefore.mainHand, 'staff');
  assert.equal(adventureAfter.mainHand, 'lantern');
  assert.notEqual(homeBefore.signature, homeAfter.signature);
  assert.notEqual(adventureBefore.overlaySignature, adventureAfter.overlaySignature);
  assert.equal(homeBefore.itemNames.includes('Walking Staff'), true);
  assert.equal(homeAfter.itemNames.includes('Wayfarer Lantern'), true);
  assert.equal(adventureBefore.itemNames.includes('Walking Staff'), true);
  assert.equal(adventureAfter.itemNames.includes('Wayfarer Lantern'), true);

  assert.equal(homeBefore.hair, adventureBefore.hair);
  assert.equal(homeBefore.skin, adventureBefore.skin);
  assert.equal(homeBefore.eye, adventureBefore.eye);
  assert.equal(adventureBefore.palette.h, homeBefore.hair);
  assert.equal(adventureBefore.palette.s, homeBefore.skin);
  assert.equal(adventureBefore.palette.e, homeBefore.eye);
  assert.equal(adventureBefore.palette.t, homeBefore.tunic);
  assert.equal(homeAfter.hair, adventureAfter.hair);
  assert.equal(homeAfter.name, adventureAfter.name);
  assert.equal(homeAfter.name, 'Rowan Hale');

  for (const rows of Object.values(adventureAfter.overlays)) {
    assert.equal(rows.length, SPRITE_HEIGHT);
    assert.equal(rows.every((row) => row.length === SPRITE_WIDTH), true);
  }

  const bonusesBefore = gameplayBonuses(effectsForItems(itemIds(before)));
  const bonusesAfter = gameplayBonuses(effectsForItems(itemIds(after)));
  assert.equal(bonusesBefore.strength, 1);
  assert.equal(bonusesAfter.strength, 0);
  assert.equal(bonusesAfter.luck, bonusesBefore.luck + 2);
  assert.equal(bonusesBefore.endurance, bonusesAfter.endurance);
  assert.equal('bonuses' in after, false);
  assert.equal('strength' in after, false);
  assert.equal('bonuses' in homeAfter, false);
  assert.equal('strength' in adventureAfter, false);
  assert.deepEqual(structuredClone(SAMPLE_PROGRESSION), SAMPLE_PROGRESSION);
  assert.equal(SAMPLE_PROGRESSION.level, 7);
  assert.equal(levelTitle(SAMPLE_PROGRESSION), 'LEVEL 7 — WAYFARER');
  assert.equal(xpLabel(SAMPLE_PROGRESSION), '720 / 1,000');

  const hoodOnly = withEquippedItem(before, TRAVELERS_HOOD);
  assert.deepEqual(itemIds(hoodOnly), itemIds(before));
  assert.deepEqual(effectsForItems(itemIds(hoodOnly)), effectsForItems(itemIds(before)));
});

test('home and adventure views are wired to the shared render models', () => {
  assert.match(homeSource, /homeCharacterModel\(appearance\)/);
  assert.match(homeSource, /HomeCharacter/);
  assert.match(homeSource, /EquipSlot|Loadout/);
  assert.match(homeArtSource, /homeAriaLabel\(model\)/);
  assert.match(homeArtSource, /model\.mainHand === 'lantern'/);
  assert.match(homeArtSource, /model\.hair/);
  assert.match(adventureSource, /adventureCharacterModel\(appearance\)/);
  assert.match(adventureArtSource, /AdventurerSprite/);
  assert.match(adventureArtSource, /model\.palette/);
  assert.match(adventureArtSource, /model\.overlays/);
  assert.match(adventureArtSource, /adventureAriaLabel\(model\)/);
  assert.match(read('components/preview/CompareScreen.tsx'), /homeCharacterModel/);
  assert.match(read('components/preview/CompareScreen.tsx'), /adventureCharacterModel/);
  assert.match(read('components/preview/CharacterScreen.tsx'), /CharacterViewer/);
  assert.doesNotMatch(previewSource, /Daily Mode/i);
});

test("today's quests are the sample five and complete in place", () => {
  assert.deepEqual(SAMPLE_QUESTS.map((quest) => quest.title), [
    'Work out 30 min',
    'Drink 8 glasses of water',
    'Read 20 pages',
    'Review budget 10 min',
    'In bed by 11 PM',
  ]);
  assert.match(homeSource, /TODAY'S QUESTS/);
  assert.match(homeSource, /QuestSheet/);
  assert.doesNotMatch(homeSource, /href="\/quests/);
  assert.match(read('components/preview/QuestSheet.tsx'), /Mark complete/);
  assert.match(read('components/preview/QuestSheet.tsx'), /role="dialog"/);
});

test('preview routes do not import a Supabase client or write over the network', () => {
  const forbidden = [
    /supabase/i,
    /@supabase/,
    /\bfetch\s*\(/,
    /XMLHttpRequest/,
    /sendBeacon/,
    /WebSocket/,
    /\.rpc\s*\(/,
    /\.from\(\s*['"`]/,
    /localStorage/,
    /\bupsert\s*\(/,
    /service_role/i,
  ];
  for (const file of previewFiles) {
    const source = readFileSync(file, 'utf8');
    for (const pattern of forbidden) {
      assert.equal(pattern.test(source), false, `${file} matched ${pattern}`);
    }
  }
  assert.match(frameSource, /Preview — nothing is saved/);
  const previewBypass = middleware.indexOf("startsWith('/preview/')");
  const refresh = middleware.indexOf('refreshSession(request)');
  assert.equal(previewBypass > -1 && previewBypass < refresh, true);
});

test('the title is a launch gate in sessionStorage and the skip setting is not built', () => {
  assert.equal(TITLE_SEEN_KEY, 'life-ascension.preview.titleSeen');
  assert.match(TITLE_SCREEN_BEHAVIOR, /sessionStorage/);
  assert.match(TITLE_SCREEN_BEHAVIOR, /tab switch/i);
  assert.match(TITLE_SCREEN_BEHAVIOR, /\/preview\/home/);
  assert.match(TITLE_SKIP_SETTING_TODO, /TODO/);
  assert.match(TITLE_SKIP_SETTING_TODO, /not built/i);
  assert.match(titleSource, /TODO: a future setting may skip the title screen\. Not built\./);
  assert.match(titleSource, /TITLE_SEEN_KEY/);
  assert.match(titleSource, /visibilitychange/);
  assert.match(titleSource, /pageshow/);
  assert.match(titleSource, /LIFE ASCENSION/);
  assert.match(titleSource, /TAP TO BEGIN/);
  assert.match(titleSource, /\/preview\/home/);
  assert.doesNotMatch(titleSource, /removeItem/);
  assert.doesNotMatch(titleSource, /Today's quest|LEVEL|progressbar/);
  assert.match(read('app/preview/preview.css'), /prefers-reduced-motion/);
  assert.match(read('components/preview/usePreviewAppearance.ts'), /MAIN_HAND_STORAGE_KEY/);
  assert.match(read('components/preview/usePreviewAppearance.ts'), /sessionStorage/);
  assert.equal(MAIN_HAND_STORAGE_KEY, 'life-ascension.preview.mainHandId');
});

test('preview navigation is quests, character, adventure, and inventory', () => {
  assert.match(navSource, /label: 'Quests'/);
  assert.match(navSource, /label: 'Character'/);
  assert.match(navSource, /label: 'Adventure'/);
  assert.match(navSource, /label: 'Inventory'/);
  assert.match(navSource, /\/preview\/adventure/);
  assert.match(navSource, /beginTransition/);
  assert.doesNotMatch(navSource, /Daily Mode|\/play/);
});
