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
import { appearanceFromLoadout, sanitizeAppearanceColors } from '../lib/preview/appearance.ts';
import {
  DEFAULT_EQUIPMENT_IDS,
  colorsForCosmetics,
  equipCatalogId,
} from '../lib/preview/catalog.ts';
import { COLOR_CHOICES, HAIR_CHOICES } from '../lib/preview/creator.ts';
import {
  SAMPLE_PROGRESSION,
  crossedLevelThreshold,
  levelTitle,
  levelUpView,
  progressFromXp,
  xpLabel,
} from '../lib/preview/progression.ts';
import { SAMPLE_QUESTS, displayedQuestXp } from '../lib/preview/sampleQuests.ts';

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

test('meal quest tracks three distinct logs and awards completion only at 3/3', () => {
  assert.match(homeSource, /mealLogLock\.current\.has\(meal\)/);
  assert.match(homeSource, /next\.length === MEAL_KEYS\.length/);
  assert.match(homeSource, /mealLogLock\.current\.size !== MEAL_KEYS\.length/);
  assert.match(homeSource, /aria-pressed=\{loggedMeals\.includes\(meal\)\}/);
  assert.match(read('lib/preview/sampleQuests.ts'), /'breakfast', 'lunch', 'dinner'/);
});

test('completed quests collapse below unfinished quests in Home preview', () => {
  assert.match(homeSource, /pendingQuests\.map/);
  assert.match(homeSource, /completedQuests\.map/);
  assert.match(homeSource, /aria-expanded=\{showCompleted\}/);
  assert.match(homeSource, /completed-quest-list/);
});

test('front-facing game avatar uses shared equipment palette and renders held gear', () => {
  assert.match(homeArtSource, /viewBox="0 0 240 380"/);
  assert.match(homeArtSource, /model\.tunic/);
  assert.match(homeArtSource, /model\.trousers/);
  assert.match(homeArtSource, /model\.boots/);
  assert.match(homeArtSource, /model\.mainHand === 'lantern'/);
  assert.match(homeArtSource, /data-prop="staff"/);
  assert.match(homeArtSource, /data-prop="lantern"/);
});

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
  assert.doesNotMatch(homeSource, /<Loadout|<EquipSlot/);
  assert.match(homeSource, /completedIds\.current\.has\(quest\.id\)/);
  assert.match(homeSource, /completedIds\.current\.add\(quest\.id\)/);
  assert.match(homeSource, /currentXp\.current = nextXp/);
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
  assert.doesNotMatch(read('components/preview/CharacterScreen.tsx'), /CharacterViewer|Examine adventure sprite/);
  assert.doesNotMatch(previewSource, /Daily Mode/i);
});

test("today's quests include the meal quest and complete in place", () => {
  assert.deepEqual(SAMPLE_QUESTS.map((quest) => quest.title), [
    'Fuel the Adventurer',
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

test('completion feedback displays the sample quest XP and does not change progression', () => {
  const before = structuredClone(SAMPLE_PROGRESSION);
  const readQuest = SAMPLE_QUESTS.find((quest) => quest.title === 'Read 20 pages');
  const bed = SAMPLE_QUESTS.find((quest) => quest.title === 'In bed by 11 PM');
  assert.equal(displayedQuestXp(readQuest), 160);
  assert.equal(displayedQuestXp(bed), 320);
  assert.deepEqual(SAMPLE_PROGRESSION, before);
  const fx = read('components/preview/QuestCompleteFx.tsx');
  assert.match(fx, /data-xp-float=\{amount\}/);
  assert.match(fx, /\+\{amount\} XP/);
  assert.doesNotMatch(fx, /setXp|levelUpView|crossedLevelThreshold|progressionFromTotal/);
  assert.match(read('components/preview/HomeScreen.tsx'), /displayedQuestXp\(quest\)/);
  assert.match(read('components/preview/HomeScreen.tsx'), /QuestCompleteFx|floatXp/);
  assert.doesNotMatch(previewSource, /streak/i);
});

test('level-up plays only when XP crosses a level threshold', () => {
  assert.equal(progressFromXp(720).level, 7);
  assert.equal(progressFromXp(720).title, 'Wayfarer');
  assert.equal(progressFromXp(720).xpInto, 720);
  assert.equal(crossedLevelThreshold(720, 880), false);
  assert.equal(levelUpView(720, 880), null);
  assert.equal(crossedLevelThreshold(720, 999), false);
  assert.equal(crossedLevelThreshold(1000, 1500), false);
  assert.equal(levelUpView(1000, 1500), null);
  assert.equal(crossedLevelThreshold(720, 720), false);
  assert.equal(crossedLevelThreshold(1040, 1000), false);

  assert.equal(crossedLevelThreshold(720, 1040), true);
  assert.equal(crossedLevelThreshold(999, 1000), true);
  const view = levelUpView(720, 1040);
  assert.equal(view.level, 8);
  assert.equal(view.title, 'Pathfinder');
  assert.equal(view.stats.find((stat) => stat.label === 'STR').after, 5);
  assert.equal(view.unlocks.includes('+1 Strength'), true);
  assert.match(read('components/preview/LevelUpCelebration.tsx'), />Skip</);
  assert.match(read('components/preview/HomeScreen.tsx'), /levelUpView\(previousXp, nextXp\)/);
  assert.match(read('app/preview/preview.css'), /xp-rise|cheer|level-in/);
});

test('creator colors and inventory equip update both renders without appearance granting bonuses', () => {
  const base = appearanceFromLoadout({ equipmentIds: DEFAULT_EQUIPMENT_IDS });
  assert.deepEqual(itemIds(base), itemIds(SAMPLE_APPEARANCE));
  const black = HAIR_CHOICES.find((choice) => choice.label === 'Black');
  const recolored = appearanceFromLoadout({ equipmentIds: DEFAULT_EQUIPMENT_IDS, colors: black.colors });
  assert.equal(homeCharacterModel(recolored).hair, '#1A120E');
  assert.equal(adventureCharacterModel(recolored).palette.h, homeCharacterModel(recolored).hair);
  assert.equal(homeCharacterModel(recolored).skin, homeCharacterModel(base).skin);
  assert.deepEqual(effectsForItems(itemIds(recolored)), effectsForItems(itemIds(base)));
  assert.deepEqual(structuredClone(SAMPLE_PROGRESSION), SAMPLE_PROGRESSION);
  assert.equal('strength' in sanitizeAppearanceColors({ hair: '#112233', strength: 9, luck: 3 }), false);
  assert.equal(sanitizeAppearanceColors({ hair: '#112233', strength: 9 }).hair, '#112233');

  const dyedIds = equipCatalogId(DEFAULT_EQUIPMENT_IDS, [], 'wine-cloak-dye');
  assert.deepEqual(dyedIds.equipmentIds, [...DEFAULT_EQUIPMENT_IDS]);
  const dyed = appearanceFromLoadout({
    equipmentIds: dyedIds.equipmentIds,
    colors: colorsForCosmetics(dyedIds.cosmeticIds),
  });
  assert.equal(homeCharacterModel(dyed).tunic, '#6E2438');
  assert.equal(adventureCharacterModel(dyed).palette.t, '#6E2438');
  assert.deepEqual(gameplayBonuses(effectsForItems(itemIds(dyed))), gameplayBonuses(effectsForItems(itemIds(base))));

  const lantern = equipCatalogId(DEFAULT_EQUIPMENT_IDS, [], 'wayfarer-lantern');
  assert.equal(lantern.equipmentIds.includes('walking-staff'), false);
  assert.equal(lantern.equipmentIds.includes('wayfarer-lantern'), true);
  const after = appearanceFromLoadout({ equipmentIds: lantern.equipmentIds });
  assert.equal(homeCharacterModel(after).mainHand, 'lantern');
  assert.equal(adventureCharacterModel(after).mainHand, 'lantern');
  assert.notEqual(homeCharacterModel(base).signature, homeCharacterModel(after).signature);
  assert.notEqual(adventureCharacterModel(base).overlaySignature, adventureCharacterModel(after).overlaySignature);
  assert.equal(gameplayBonuses(effectsForItems(lantern.equipmentIds)).luck, 2);
  assert.equal(gameplayBonuses(effectsForItems(itemIds(base))).strength, 1);
  assert.match(read('components/preview/InventoryScreen.tsx'), /item\.category === 'equipment'/);
  assert.match(read('components/preview/InventoryScreen.tsx'), /Cosmetic/);
  assert.doesNotMatch(read('components/preview/CharacterScreen.tsx'), /<ChoiceRow|<CharacterPair/);
  assert.match(read('components/preview/CharacterScreen.tsx'), /character-loadout-stage/);
  assert.equal(COLOR_CHOICES.some((choice) => choice.colors.tunic || choice.colors.eye), true);
});

test('preview navigation is quests, character, adventure, and inventory', () => {
  assert.match(navSource, /label: 'Home'/);
  assert.match(navSource, /label: 'Character'/);
  assert.match(navSource, /label: 'Adventure'/);
  assert.match(navSource, /label: 'Inventory'/);
  assert.match(navSource, /\/preview\/adventure/);
  assert.match(navSource, /beginTransition/);
  assert.doesNotMatch(navSource, /Daily Mode|\/play/);
});

test('character equipment slots open available gear choices', () => {
  const character = read('components/preview/CharacterScreen.tsx');
  assert.match(character, /setSelectedSlot/);
  assert.match(character, /PREVIEW_CATALOG\.filter/);
  assert.match(character, /if \(nextEquipped\) equip\(itemId\); else unequip\(itemId\)/);
  assert.match(character, /aria-expanded=\{selectedSlot === slot\.key\}/);
  assert.match(character, /role="dialog"/);
  assert.match(character, /No items for this slot yet/);
});

test('inventory supports equipment-slot filters', () => {
  const inventory = read('components/preview/InventoryScreen.tsx');
  assert.match(inventory, /inventory-filters/);
  assert.match(inventory, /GROUPS\.map/);
  assert.match(inventory, /aria-pressed=\{filter === slot\}/);
});

test('visible outfit palette derives from equipped armor legs and feet', () => {
  const appearance = read('lib/preview/appearance.ts');
  assert.match(appearance, /chest\.accent/);
  assert.match(appearance, /legs\.accent/);
  assert.match(appearance, /feet\.accent/);
  assert.match(appearance, /gearColors/);
});
