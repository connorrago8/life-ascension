import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { applyFdcFood, clearFdcMatch } from '../lib/nutrition/fdc.ts';
import { matchPortion } from '../lib/nutrition/portions.ts';
import { paidAiEnabled, photoExperimentEnabled, monthlyCostFlag } from '../lib/nutrition/config.ts';
import { measuredDeterministicCost, estimateUsd } from '../lib/nutrition/cost.ts';
import { nutritionToday, previousGameDay } from '../lib/nutrition/dates.ts';
import { parseMealText, reuseIdempotencyKey, scaleItem } from '../lib/nutrition/parseFood.ts';
import { overview, sumLines } from '../lib/nutrition/summary.ts';
import { MEAL_XP, sourceBadge } from '../lib/nutrition/types.ts';
import { healthGameDay } from '../lib/ascension/lightsOut.ts';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const noon = new Date('2026-11-26T18:00:00Z');
const midnight = new Date('2026-11-26T06:00:00Z');

function parse(text, ctx = {}) {
  return parseMealText(text, { now: noon, ...ctx });
}
function meal(text, ctx) {
  const result = parse(text, ctx);
  assert.equal(result.paidAi, false);
  return result.meals;
}
function names(text, ctx) {
  return meal(text, ctx).flatMap((row) => row.items.map((item) => item.name.toLowerCase()));
}

test('parser edge cases from the QA playbook', () => {
  const two = meal('Had eggs this morning and a chicken sandwich for lunch');
  assert.equal(two.length, 2);
  assert.equal(two[0].mealLabel, 'Breakfast');
  assert.equal(two[1].mealLabel, 'Lunch');
  assert.match(names('Had eggs this morning and a chicken sandwich for lunch').join('|'), /egg/);
  assert.match(names('Had eggs this morning and a chicken sandwich for lunch').join('|'), /sandwich/);

  const shift = meal('Red Bull and a protein bar throughout my shift');
  assert.equal(shift.length, 1);
  assert.equal(shift[0].items.length, 2);
  assert.equal(JSON.stringify(shift).includes('consumedAt'), false);

  const half = meal('Half a burrito')[0].items[0];
  assert.equal(half.quantity, 0.5);
  assert.ok(half.calories > 0);

  const bun = meal('Burger but no bun')[0];
  assert.equal(bun.items.some((item) => /bun/.test(item.name.toLowerCase())), false);
  assert.match(bun.assumptions.join(' '), /Bun left out/);

  const side = meal('Chicken salad with dressing on the side')[0];
  assert.equal(side.items.some((item) => /dressing/.test(item.name.toLowerCase())), false);
  assert.match(side.clarification, /optional/i);
  assert.equal((side.clarification.match(/\?/g) || []).length, 1);

  const chips = meal('A handful of chips')[0].items[0];
  assert.equal(chips.confidence, 'low');
  assert.ok(chips.assumption);

  const almonds = meal('Two handfuls of almonds')[0].items[0];
  assert.equal(almonds.quantity, 2);
  assert.equal(almonds.unit, 'oz');

  const coffee = meal('Coffee with a splash of cream')[0];
  assert.equal(coffee.items.length, 2);
  assert.ok(coffee.items.some((item) => /cream/i.test(item.name)));

  const pasta = meal('Pasta with a lot of parmesan')[0];
  assert.equal(pasta.items.length, 2);
  assert.equal(pasta.items.find((item) => /parmesan/i.test(item.name)).confidence, 'low');

  assert.match(meal('Leftover chicken from yesterday')[0].assumptions.join(' '), /typical|earlier|yesterday/i);

  const copied = meal('Same breakfast as yesterday but no toast', {
    history: [{ diaryDate: previousGameDay(noon), mealLabel: 'Breakfast', items: [
      { name: 'Eggs', quantity: 2, unit: 'large', calories: 144, proteinG: 12, carbsG: 0, fatG: 10, fiberG: 0, fluidOz: null },
      { name: 'Toast', quantity: 1, unit: 'slice', calories: 80, proteinG: 3, carbsG: 14, fatG: 1, fiberG: 1, fluidOz: null },
    ] }],
  })[0];
  assert.equal(copied.kind, 'recall');
  assert.equal(copied.items.some((item) => /toast/i.test(item.name)), false);
  assert.equal(copied.items[0].source, 'personal');

  const other = meal('Ate the other half of my burrito', {
    history: [{ diaryDate: '2026-11-25', mealLabel: 'Lunch', items: [
      { name: 'Burrito', quantity: 0.5, unit: 'serving', calories: 400, proteinG: 18, carbsG: 45, fatG: 14, fiberG: 4, fluidOz: null },
    ] }],
  })[0];
  assert.match(other.assumptions.join(' '), /earlier burrito/i);
  assert.equal(other.items[0].source, 'personal');

  const pizza = meal('Three slices of pizza, pepperoni I think')[0];
  assert.equal(pizza.items.length, 1);
  assert.equal(pizza.items[0].quantity, 3);
  assert.equal(pizza.items[0].confidence, 'low');

  const drinks = meal('Two beers and some wings')[0];
  assert.equal(drinks.items.length, 2);
  assert.equal(drinks.items[0].quantity, 2);
  assert.ok(drinks.items[0].fluidOz > 0);
  assert.equal(drinks.items[1].quantity, 6);

  const vodka = meal('Vodka soda with lime')[0];
  assert.equal(vodka.items.length, 1);
  assert.match(vodka.items[0].assumption, /No sugary mixer/);
  assert.equal(vodka.items.some((item) => /juice/.test(item.name.toLowerCase())), false);

  const fries = meal('Large fries split with Izzy')[0];
  assert.match(fries.assumptions.join(' '), /half/i);
  assert.ok(fries.items[0].calories < 370 * 1.4);

  const bites = meal("A few bites of Izzy's dessert")[0].items[0];
  assert.equal(bites.confidence, 'low');
  assert.equal(bites.quantity, 0.25);

  const cfa = meal('Chik fil a sandwhich')[0].items[0];
  assert.match(cfa.name, /Chick-fil-A/);
  assert.match(cfa.assumption, /official/i);
  assert.notEqual(cfa.source, 'usda_fdc');

  assert.deepEqual(names('Chikn rice brocoli').sort(), ['broccoli', 'chicken', 'white rice'].sort());

  const range = meal('I think it was 6 or 8 ounces of chicken')[0].items[0];
  assert.equal(range.quantity, 7);
  assert.equal(range.confidence, 'low');
  assert.match(range.assumption, /6–8|6-8/);

  const raw = meal('Chicken and rice, weighed before cooking')[0];
  assert.equal(raw.items.length, 2);
  assert.match(raw.assumptions.join(' '), /before cooking/i);

  const adjust = meal('Actually make that two eggs')[0];
  assert.equal(adjust.kind, 'adjust');
  assert.equal(adjust.setQuantity, 2);
  assert.match(adjust.foodHint, /egg/);

  assert.equal(meal("Never mind, didn't eat that")[0].kind, 'remove');

  const forgot = meal('Forgot to log dinner last night')[0];
  assert.equal(forgot.diaryDate, previousGameDay(noon));
  assert.equal(forgot.mealLabel, 'Dinner');
  assert.equal(forgot.items.length, 0);
  assert.match(forgot.clarification, /optional/i);

  const usual = meal('Same protein shake I always drink', {
    memory: [{ alias: 'protein shake', name: 'Protein shake', items: [
      { name: 'Protein shake', quantity: 1, unit: 'shake', calories: 180, proteinG: 32, carbsG: 6, fatG: 3, fiberG: 1, fluidOz: 11 },
    ] }],
  })[0];
  assert.equal(usual.items[0].source, 'personal');
  assert.equal(usual.items[0].calories, 180);
  assert.equal(usual.paidAi ?? false, false);

  const salad = meal('Salad')[0];
  assert.match(salad.clarification, /optional/i);
  assert.equal(salad.items.length, 1);
  assert.ok(salad.items[0].calories > 0);

  const scoop = meal('One scoop of protein powder')[0];
  assert.equal(scoop.items[0].quantity, 1);
  assert.match(scoop.clarification, /Which brand/i);

  const whole = meal('A whole frozen pizza')[0].items[0];
  assert.match(whole.assumption, /Whole pizza|whole package/i);
  assert.match(whole.assumption, /not one labeled serving/i);

  const label = meal('Three servings according to the label')[0];
  assert.equal(label.items.length, 0);
  assert.match(label.clarification, /optional/i);
  assert.equal(label.items.some((item) => item.calories === 0), false);

  const water = meal('Drank water throughout the day')[0].items[0];
  assert.equal(water.fluidOz, 8);
  assert.match(water.assumption, /not stated|placeholder/i);
  assert.ok(water.fluidOz < 32);

  const day = meal('Lunch was chicken, rice and broccoli, dinner was sushi');
  assert.equal(day.length, 2);
  assert.equal(day[0].mealLabel, 'Lunch');
  assert.equal(day[0].items.length, 3);
  assert.equal(day[1].mealLabel, 'Dinner');
  assert.match(day[1].items[0].name, /Sushi/i);

  const late = meal('Had a sandwich around midnight')[0];
  assert.equal(late.diaryDate, nutritionToday(noon));
  assert.match(late.clarification, /optional/i);
  const atMidnight = meal('Had a sandwich around midnight', { now: midnight })[0];
  assert.equal(atMidnight.diaryDate, healthGameDay(midnight));
  assert.equal(atMidnight.clarification, null);

  const uneaten = meal("Ordered fries but didn't eat them")[0];
  assert.equal(uneaten.items.length, 0);
  assert.match(uneaten.assumptions.join(' '), /not eaten|not logged/i);

  const mayo = meal('Chicken sandwich with extra mayo')[0];
  assert.equal(mayo.items.length, 2);
  assert.ok(mayo.items.some((item) => /mayo/i.test(item.name)));

  assert.equal(reuseIdempotencyKey('second', 'first'), 'first');
  assert.equal(reuseIdempotencyKey('second', null), 'second');
});

test('reviewer phrases and Connor scenarios stay editable estimates', () => {
  const chipotle = meal('Half a burrito from Chipotle')[0].items[0];
  assert.equal(chipotle.quantity, 0.5);
  assert.match(chipotle.name, /Chipotle/);
  assert.match(chipotle.assumption, /Not a restaurant|not a restaurant|official/i);
  assert.equal(chipotle.source, 'generic');

  assert.equal(meal('2 eggs n toast w butter')[0].items.length, 3);

  const remembered = meal('Same breakfast as yesterday', {
    history: [{ diaryDate: previousGameDay(noon), mealLabel: 'Breakfast', items: [
      { name: 'Eggs', quantity: 2, unit: 'large', calories: 144, proteinG: 12, carbsG: 0, fatG: 10, fiberG: 0, fluidOz: null },
    ] }],
  })[0];
  assert.equal(remembered.items[0].source, 'personal');

  const vague = meal('A couple handfuls of chips')[0].items[0];
  assert.equal(vague.confidence, 'low');
  assert.equal(vague.quantity, 2);

  assert.match(meal('Chik fil a sandwich')[0].items[0].name, /Chick-fil-A/);
  assert.match(meal('Izzy made chicken pasta')[0].items[0].assumption, /Homemade|approximate/i);
  assert.equal(meal('Coffee with a splash of cream')[0].items.length, 2);
  assert.equal(meal('Actually, I only ate half')[0].factor, 0.5);
  assert.equal(meal('Forgot to log dinner yesterday')[0].diaryDate, previousGameDay(noon));

  const genericShake = meal('One protein shake, no idea which brand')[0];
  assert.equal(genericShake.items[0].source, 'generic');
  assert.match(genericShake.clarification, /Which brand/i);
  assert.ok(genericShake.items[0].calories > 0);

  const bull = meal('Sugar-free Red Bull')[0].items[0];
  assert.ok(bull.fluidOz > 0);
  assert.ok(bull.calories < 30);
  assert.equal(meal('burger and fries delivery')[0].note, 'Delivery order');
  assert.equal(meal('burger and fries delivery')[0].items.length, 2);

  const learned = meal('eggs', {
    portions: [{ foodKey: 'egg', quantity: 3, unit: 'large', calories: 216, proteinG: 18, carbsG: 0, fatG: 15, fiberG: 0, fluidOz: null }],
  })[0].items[0];
  assert.equal(learned.source, 'personal');
  assert.equal(learned.quantity, 3);
  const stated = meal('2 eggs', {
    portions: [{ foodKey: 'egg', quantity: 3, unit: 'large', calories: 216, proteinG: 18, carbsG: 0, fatG: 15, fiberG: 0, fluidOz: null }],
  })[0].items[0];
  assert.equal(stated.quantity, 2);
  assert.notEqual(stated.source, 'personal');
});

test('portion phrases are food-aware defaults, not facts', () => {
  const milk = matchPortion('a splash of milk', 'milk');
  const nuts = matchPortion('a handful of almonds', 'almonds');
  assert.equal(milk.unit, 'tbsp');
  assert.equal(nuts.unit, 'oz');
  assert.notEqual(milk.unit, nuts.unit);
  assert.match(milk.assumption, /edit/i);
  assert.match(nuts.assumption, /edit/i);
});

test('USDA match replaces a generic only when the portion converts', () => {
  const egg = meal('100 g egg')[0].items[0];
  const matched = applyFdcFood(egg, {
    fdcId: 171287,
    description: 'Egg, whole, raw, fresh',
    foodNutrients: [
      { nutrientId: 1008, value: 143 },
      { nutrientId: 1003, value: 12.6 },
      { nutrientId: 1005, value: 0.7 },
      { nutrientId: 1004, value: 9.5 },
      { nutrientId: 1079, value: 0 },
    ],
  });
  assert.equal(clearFdcMatch('egg', 'Egg, whole, raw, fresh'), true);
  assert.equal(matched.source, 'usda_fdc');
  assert.equal(matched.fdcId, 171287);
  assert.equal(matched.calories, 143);
  assert.equal(applyFdcFood(egg, { fdcId: 1, description: 'Ketchup', foodNutrients: [{ nutrientId: 1008, value: 100 }] }), null);
});

test('summaries do not treat missing fiber as zero and do not praise restriction', () => {
  const unknown = sumLines([{ calories: 10, proteinG: 1, carbsG: 1, fatG: 1, fiberG: null, fluidOz: 8 }]);
  assert.equal(unknown.fiberG, null);
  assert.equal(unknown.fluidOz, 8);
  const snap = overview([{ diaryDate: '2026-11-26', mealLabel: 'Drink', calories: 10, proteinG: 1, carbsG: 1, fatG: 0, fiberG: null, fluidOz: 8.4 }]);
  assert.equal(snap.meals, 1);
  assert.equal(snap.proteinG, 1);
  assert.equal(snap.fluidOz, 8.4);
});

test('paid AI and photo logging stay off and deterministic parses cost $0', () => {
  assert.equal(paidAiEnabled({}), false);
  assert.equal(paidAiEnabled({ NUTRITION_PAID_AI: 'true' }), false);
  assert.equal(paidAiEnabled({ NUTRITION_PAID_AI: '1' }), true);
  assert.equal(photoExperimentEnabled({}), false);
  assert.equal(photoExperimentEnabled({ NUTRITION_PHOTO_EXPERIMENT: '1' }), true);
  assert.deepEqual(measuredDeterministicCost(), { inputTokens: 0, outputTokens: 0, estimatedUsd: 0, paidAi: false });
  assert.equal(monthlyCostFlag(0), 'within-target');
  assert.equal(monthlyCostFlag(10), 'review');
  assert.equal(MEAL_XP, 0);
  assert.equal(sourceBadge('usda_fdc'), 'USDA match');
  assert.equal(sourceBadge('ai_text'), 'AI estimate');
  assert.equal(sourceBadge('generic'), 'Estimate, you can edit this');
  const started = Date.now();
  for (let i = 0; i < 100; i += 1) parse('protein shake');
  assert.ok(Date.now() - started < 1500);
  const doubled = scaleItem(meal('protein shake')[0].items[0], 2);
  assert.equal(doubled.quantity, 2);
  assert.ok(doubled.calories > meal('protein shake')[0].items[0].calories);
});

test('diary date uses the 5 AM Chicago game day', () => {
  assert.equal(nutritionToday(midnight), healthGameDay(midnight));
  assert.notEqual(nutritionToday(midnight), nutritionToday(new Date('2026-11-26T11:00:00Z')));
  assert.equal(estimateUsd(0, 0), 0);
});

test('schema, copy, and existing health behavior stay isolated', () => {
  const sql = read('supabase/migrations/202611280010_nutrition_diary.sql');
  const ui = read('components/ascension/NutritionDiary.tsx');
  const health = read('components/ascension/HealthPanel.tsx');
  const route = read('app/api/nutrition/parse/route.ts');
  const mcp = read('app/api/mcp/route.ts');
  assert.match(sql, /diary_date date not null/);
  assert.match(sql, /unique \(owner_id, idempotency_key\)/);
  assert.match(sql, /xp_awarded', 0/);
  assert.doesNotMatch(sql, /insert into public\.xp_ledger/i);
  assert.match(sql, /revoke all on function public\.read_nutrition_for_grant/);
  assert.match(sql, /nutrition:summary/);
  assert.doesNotMatch(sql, /from public\.finance_|from public\.pharmacy/);
  assert.match(sql, /for select to authenticated using \(\(select auth\.uid\(\)\) = owner_id\)/);
  assert.doesNotMatch(sql, /drop table public\.health_meals/);
  for (const line of ['Log a meal', 'Review estimate', 'Adjust portion', 'Repeat meal', 'Save as favorite', 'Nutrition overview', 'No entries yet', 'Estimate, you can edit this', "You've logged your meal"]) {
    assert.ok(ui.includes(line), line);
  }
  assert.doesNotMatch(ui, /deficit|shame|guilty|overate|cheat day/i);
  assert.match(ui, /0 XP/);
  assert.match(health, /NutritionDiary/);
  assert.match(health, /record_lights_out/);
  assert.match(health, /save_health_meal/);
  assert.match(health, /save_health_notes/);
  assert.match(route, /paidAiEnabled\(\)/);
  assert.match(route, /Photo logging is off/);
  assert.match(route, /USDA_FDC_API_KEY/);
  assert.doesNotMatch(route, /NEXT_PUBLIC_USDA/);
  assert.match(mcp, /nutrition:read is disabled/);
  assert.doesNotMatch(read('lib/nav.ts'), /nutrition/);
});
