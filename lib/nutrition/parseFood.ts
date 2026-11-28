import { shiftDate } from '../ascension/dates.ts';
import { matchGeneric, peelKnownFoods, type GenericFood } from './generics.ts';
import { loggingClockIsBeforeGameDayStart, nutritionToday, previousGameDay } from './dates.ts';
import { matchPortion } from './portions.ts';
import type {
  Confidence,
  DraftItem,
  DraftMeal,
  HistoryMeal,
  ItemSource,
  MemoryItem,
  MemoryMeal,
  ParseContext,
  PortionMemory,
} from './types.ts';

export type ParseResult = {
  meals: DraftMeal[];
  paidAi: false;
};

const KEEP_WITH = /^(lime|lemon|ice)$/;

export function parseMealText(input: string, ctx: ParseContext): ParseResult {
  const text = normalizeFoodText(input);
  if (!text) return { meals: [], paidAi: false };
  const command = commandMeal(text, ctx);
  if (command) return { meals: command, paidAi: false };
  const when = resolveWhen(text, ctx.now);
  const chunks = splitMeals(text);
  const meals = chunks.map((chunk) => mealFromChunk(chunk, when, ctx, text));
  return { meals, paidAi: false };
}

export function normalizeFoodText(input: string): string {
  let text = input.trim().toLowerCase().replace(/\s+/g, ' ');
  text = text.replace(/\bsandwhich\b/g, 'sandwich');
  text = text.replace(/\bbrocoli\b/g, 'broccoli');
  text = text.replace(/\bchikn\b/g, 'chicken');
  text = text.replace(/\bchick[-\s]*fil[-\s]*a\b/g, 'chick-fil-a');
  text = text.replace(/\bchik[-\s]*fil[-\s]*a\b/g, 'chick-fil-a');
  text = text.replace(/\b(\w+)\s+n\s+(\w+)\b/g, '$1 and $2');
  text = text.replace(/\bw\/\s*/g, 'with ');
  text = text.replace(/\s\bw\s+/g, ' with ');
  return text.trim();
}

export function reuseIdempotencyKey(current: string, retryOf: string | null): string {
  return retryOf ?? current;
}

export function scaleItem(item: DraftItem, quantity: number): DraftItem {
  const factor = item.quantity > 0 ? quantity / item.quantity : 1;
  return {
    ...item,
    quantity,
    calories: round1(item.calories * factor),
    proteinG: round1(item.proteinG * factor),
    carbsG: round1(item.carbsG * factor),
    fatG: round1(item.fatG * factor),
    fiberG: item.fiberG === null ? null : round1(item.fiberG * factor),
    fluidOz: item.fluidOz === null ? null : round1(item.fluidOz * factor),
    source: item.source === 'personal' || item.source === 'usda_fdc' ? item.source : 'user_edited',
    assumption: `Portion set to ${trimNum(quantity)} ${item.unit}.`,
  };
}

function commandMeal(text: string, ctx: ParseContext): DraftMeal[] | null {
  const today = nutritionToday(ctx.now);
  if (/^(?:actually,?\s+)?i only ate half\.?$/.test(text)) {
    return [blankCommand('adjust', today, 'Applied to the last meal. Counted half.', 0.5, null, null)];
  }
  const makeThat = text.match(/^actually,?\s+make that\s+(\d+|one|two|three|four|five|six|seven|eight)\s+(.+?)\.?$/);
  if (makeThat) {
    const words: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8 };
    const quantity = words[makeThat[1]] ?? Number(makeThat[1]);
    return [blankCommand('adjust', today, `Set ${makeThat[2]} to ${quantity}.`, null, quantity, makeThat[2])];
  }
  if (/^never mind,? didn'?t eat that\.?$/.test(text)) {
    return [blankCommand('remove', today, 'This removes the last meal after you confirm.', null, null, null)];
  }
  if (/^forgot to log\b/.test(text)) {
    const date = /yesterday|last night/.test(text) ? previousGameDay(ctx.now) : today;
    const label = /breakfast/.test(text) ? 'Breakfast' : /lunch/.test(text) ? 'Lunch' : 'Dinner';
    return [{
      kind: 'log',
      mealLabel: label,
      diaryDate: date,
      items: [],
      note: null,
      clarification: 'What was the meal? (optional)',
      assumptions: ['No foods were named, so nothing was invented.'],
      factor: null,
      setQuantity: null,
      foodHint: null,
    }];
  }
  const always = text.match(/^same (.+?) i always\b/);
  if (always) {
    return [recallOrGeneric(always[1], ctx, today, 'recall')];
  }
  const usual = text.match(/\bmy usual ([a-z0-9 -]+)/);
  if (usual && !/yesterday/.test(text)) {
    return [recallOrGeneric(usual[1], ctx, today, 'recall')];
  }
  if (/^same breakfast as yesterday\b/.test(text)) {
    return [yesterdayBreakfast(text, ctx)];
  }
  if (/^leftover chicken\b/.test(text)) {
    return [leftover(ctx, /yesterday/.test(text))];
  }
  if (/^ate the other half of my burrito\.?$/.test(text)) {
    return [otherHalf(ctx)];
  }
  return null;
}

function mealFromChunk(
  chunk: { label: string; body: string },
  when: { date: string; ambiguous: boolean },
  ctx: ParseContext,
  full: string,
): DraftMeal {
  const excluded = new Set<string>();
  let body = chunk.body;
  const no = body.match(/\bbut no\s+([a-z][a-z -]{0,24})/);
  if (no) {
    excluded.add(no[1].trim());
    body = body.replace(no[0], ' ');
  }
  if (/\bdressing on the side\b/.test(body)) {
    excluded.add('dressing');
    body = body.replace(/\bwith dressing on the side\b/, ' ');
  }
  const ordered = body.match(/\bordered\s+([a-z][a-z -]{0,30}?)\s+but\s+(?:didn'?t|did not)\s+eat(?:\s+them)?\b/);
  if (ordered) {
    excluded.add(ordered[1].trim());
    body = body.replace(ordered[0], ' ');
  }
  if (/three servings according to the label/.test(full)) {
    const rest = full.replace(/three servings according to the label/g, ' ');
    if (!matchGeneric(rest)) {
      return {
        kind: 'log',
        mealLabel: chunk.label,
        diaryDate: when.date,
        items: [],
        note: null,
        clarification: 'Which food was three label servings? (optional)',
        assumptions: ['No food was named, so nothing was invented and nothing was saved as zero.'],
        factor: null,
        setQuantity: null,
        foodHint: null,
      };
    }
  }
  body = body
    .replace(/\bthroughout my shift\b/g, ' ')
    .replace(/\bdelivery\b/g, ' ')
    .replace(/\btakeout\b/g, ' ')
    .replace(/\baround midnight\b/g, ' ')
    .replace(/\bizzy made\b/g, ' ')
    .replace(/\bizzy'?s\b/g, ' ')
    .replace(/\bweighed before cooking\b/g, ' ')
    .replace(/\bsplit with izzy\b/g, ' ')
    .replace(/\baccording to the label\b/g, ' ')
    .replace(/\bno idea which brand\b/g, ' ')
    .replace(/\bi think\b/g, ' ')
    .replace(/\bhad\b/g, ' ')
    .replace(/\bate\b/g, ' ')
    .replace(/\bdrank\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const phrases = splitPhrases(body);
  const raw = /weighed before cooking/.test(full);
  const splitHalf = /split with izzy/.test(full);
  const pepperoniUnsure = /pepperoni i think/.test(full);
  const brandUnknown = /no idea which brand/.test(full);
  const items: DraftItem[] = [];
  for (const phrase of phrases) {
    const built = phraseToItem(phrase, ctx, { raw, splitHalf, pepperoniUnsure, brandUnknown, excluded });
    if (built) items.push(...built.filter((item) => !isExcluded(item.name, excluded)));
  }
  if (excluded.has('bun')) {
    for (const item of items) {
      if (/burger/.test(item.name)) {
        item.calories = Math.max(0, round1(item.calories - 120));
        item.carbsG = Math.max(0, round1(item.carbsG - 25));
        item.assumption = 'Bun left out.';
        item.confidence = 'typical';
      }
    }
  }
  const assumptions = [...new Set(items.map((item) => item.assumption).filter((line): line is string => Boolean(line)))];
  if (excluded.has('dressing')) assumptions.push('Dressing was on the side, so it is not included.');
  if (excluded.has('bun')) assumptions.push('Bun left out.');
  if ([...excluded].some((name) => /fries|fry/.test(name))) assumptions.push('Ordered food that was not eaten is not logged.');
  if (raw) assumptions.push('Weight was before cooking. Cooked weight is lower; you can edit this.');
  const delivery = /\b(delivery|doordash|uber eats|takeout)\b/.test(full);
  const clarification = oneClarification(full, items, when.ambiguous);
  return {
    kind: 'log',
    mealLabel: chunk.label,
    diaryDate: when.date,
    items,
    note: delivery ? 'Delivery order' : null,
    clarification,
    assumptions,
    factor: null,
    setQuantity: null,
    foodHint: null,
  };
}

function oneClarification(full: string, items: DraftItem[], dateAmbiguous: boolean): string | null {
  if (/\bdressing on the side\b/.test(full)) return 'Include the dressing? (optional)';
  if (items.some((item) => item.assumption?.includes('Brand was not used') || /brand/i.test(item.assumption ?? ''))) {
    if (/protein|shake|bar|powder/.test(full) && (/no idea|brand/.test(full) || !/red bull|fairlife|premier|orgain/.test(full))) {
      return 'Which brand? (optional)';
    }
  }
  const brandedGap = items.find((item) => item.assumption?.includes('Brand was not used'));
  if (brandedGap && /protein powder|protein bar|protein shake/.test(full) && !/brand/.test(full)) {
    return 'Which brand? (optional)';
  }
  if (/^salad$/.test(full.trim())) return 'What was in the salad? (optional)';
  if (dateAmbiguous) return 'Use a different diary date if that midnight was another day. (optional)';
  return null;
}

function splitPhrases(body: string): string[] {
  if (!body) return [];
  if (/\bthree servings according to the label\b/.test(body) && !matchGeneric(body.replace(/three servings according to the label/g, ''))) {
    return [];
  }
  const withParts = body.split(/\s+with\s+/);
  const pieces: string[] = [];
  for (const part of withParts) {
    const bit = part.trim();
    if (!bit) continue;
    if (pieces.length > 0 && KEEP_WITH.test(bit)) {
      pieces[pieces.length - 1] = `${pieces[pieces.length - 1]} with ${bit}`;
      continue;
    }
    pieces.push(bit);
  }
  const listed: string[] = [];
  for (const piece of pieces) {
    const bits = piece.split(/\s*,\s*|\s+and\s+/).map((bit) => bit.trim()).filter(Boolean);
    for (const bit of bits) {
      if (/and|,|with/.test(bit)) {
        listed.push(bit);
        continue;
      }
      const peeled = peelKnownFoods(bit);
      listed.push(...(peeled.length > 1 ? peeled : [bit]));
    }
  }
  return listed;
}

function phraseToItem(
  phrase: string,
  ctx: ParseContext,
  flags: { raw: boolean; splitHalf: boolean; pepperoniUnsure: boolean; brandUnknown: boolean; excluded: Set<string> },
): DraftItem[] | null {
  let text = phrase.replace(/^(a|an|the|my)\s+/, '').trim();
  text = text.replace(/\b(large|medium|small)\s+/g, '$1 ');
  if (!text || /^(ordered|but|them|it|that)$/.test(text)) return null;
  if (flags.pepperoniUnsure && /^pepperoni$/.test(text)) return null;
  const memory = matchMemory(text, ctx.memory ?? []);
  if (memory && !hasExplicitQuantity(text)) {
    return memory.items.map((item) => fromMemory(item, `Matched your saved meal “${memory.alias}”.`));
  }
  const portion = matchPortion(phrase, phrase) ?? matchPortion(text, text);
  const nameSource = portion?.rest ?? text;
  const generic = matchGeneric(nameSource) ?? matchGeneric(text);
  if (!generic) {
    if (portion) {
      return [unknownItem(cleanName(portion.rest), portion.quantity, portion.unit, portion.confidence, portion.assumption)];
    }
    return [unknownItem(cleanName(text), 1, 'serving', 'low', 'No USDA match and no saved meal. A placeholder serving is filled in so you can edit it.')];
  }
  const remembered = !portion && !hasExplicitQuantity(text)
    ? (ctx.portions ?? []).find((row) => row.foodKey === generic.food.key)
    : undefined;
  if (remembered) return [fromPortionMemory(generic.food, remembered)];
  return [fromGeneric(generic.food, portion, text, flags)];
}

function fromGeneric(
  food: GenericFood,
  portion: ReturnType<typeof matchPortion>,
  phrase: string,
  flags: { raw: boolean; splitHalf: boolean; pepperoniUnsure: boolean; brandUnknown: boolean },
): DraftItem {
  let quantity = food.servingQty;
  let unit = food.servingUnit;
  let factor = 1;
  let confidence: Confidence = 'typical';
  const notes: string[] = [];
  if (food.assumption) notes.push(food.assumption);
  if (portion) {
    confidence = portion.confidence;
    if (portion.assumption) notes.push(portion.assumption);
    if (portion.unit === 'count') {
      quantity = portion.quantity;
      unit = food.servingUnit;
      factor = portion.quantity / food.servingQty;
    } else if (portion.unit === 'serving') {
      quantity = portion.quantity;
      unit = 'serving';
      factor = portion.quantity;
    } else if (portion.unit === 'whole') {
      quantity = 1;
      unit = food.servingUnit === 'slice' ? 'pizza' : food.servingUnit;
      factor = food.key === 'frozen pizza' || /pizza/.test(food.key) ? 1 : portion.quantity;
      if (/pizza/.test(phrase) && food.key !== 'frozen pizza') {
        factor = 8;
        unit = 'pizza';
        notes.push('Whole pizza counted as 8 typical slices, not one labeled serving.');
      }
    } else if (portion.unit === food.servingUnit || (portion.unit === 'oz' && food.servingUnit === 'oz')) {
      quantity = portion.quantity;
      unit = portion.unit;
      factor = portion.quantity / food.servingQty;
    } else {
      quantity = portion.quantity;
      unit = portion.unit;
      factor = portion.quantity / food.servingQty;
    }
  } else if (food.key === 'egg' && /\beggs\b/.test(phrase) && !/\d/.test(phrase)) {
    quantity = 2;
    factor = 2;
    notes.push('Assumed 2 eggs.');
  } else if (/\blarge\b/.test(phrase) && food.key === 'french fries') {
    factor = 1.4;
    quantity = 1;
    unit = 'large';
    notes.push('Large is about 1.4 typical servings.');
  } else if (/\bextra\b/.test(phrase) && food.key === 'mayonnaise') {
    notes.push('Counted one extra tablespoon.');
  }
  if (flags.splitHalf && /fries/.test(food.key)) {
    factor *= 0.5;
    quantity = round3(quantity * 0.5);
    confidence = 'low';
    notes.push('Split, so half of the order.');
  }
  if (flags.pepperoniUnsure && /pizza/.test(food.key)) {
    confidence = 'low';
    notes.push('Pepperoni was uncertain.');
  }
  if (flags.raw && /chicken|rice/.test(food.key)) {
    confidence = 'low';
    notes.push('Weight was before cooking.');
  }
  if (food.brandPrompt && (flags.brandUnknown || phrase.trim() === food.key || /\bscoop\b/.test(phrase))) {
    notes.push('Brand was not used.');
  }
  if (food.key === 'water' && !portion) confidence = 'low';
  if (/\bi think\b/.test(phrase)) confidence = 'low';
  const name = displayName(food, phrase);
  return item({
    name,
    quantity: round3(quantity),
    unit,
    food,
    factor,
    confidence,
    assumption: uniqueNotes(notes),
    source: 'generic',
  });
}

function item(input: {
  name: string;
  quantity: number;
  unit: string;
  food: GenericFood;
  factor: number;
  confidence: Confidence;
  assumption: string | null;
  source: ItemSource;
}): DraftItem {
  const factor = input.factor;
  return {
    name: input.name,
    quantity: input.quantity,
    unit: input.unit,
    calories: round1(input.food.calories * factor),
    proteinG: round1(input.food.proteinG * factor),
    carbsG: round1(input.food.carbsG * factor),
    fatG: round1(input.food.fatG * factor),
    fiberG: input.food.fiberG === null ? null : round1(input.food.fiberG * factor),
    fluidOz: input.food.fluidOz === null ? null : round1(input.food.fluidOz * factor),
    source: input.source,
    confidence: input.confidence,
    fdcId: null,
    fdcDescription: null,
    assumption: input.assumption,
  };
}

function unknownItem(name: string, quantity: number, unit: string, confidence: Confidence, assumption: string): DraftItem {
  return {
    name: name || 'Food',
    quantity,
    unit,
    calories: 100,
    proteinG: 5,
    carbsG: 10,
    fatG: 3,
    fiberG: null,
    fluidOz: null,
    source: 'convention',
    confidence,
    fdcId: null,
    fdcDescription: null,
    assumption,
  };
}

function fromMemory(itemRow: MemoryItem, assumption: string): DraftItem {
  return {
    name: itemRow.name,
    quantity: itemRow.quantity,
    unit: itemRow.unit,
    calories: itemRow.calories,
    proteinG: itemRow.proteinG,
    carbsG: itemRow.carbsG,
    fatG: itemRow.fatG,
    fiberG: itemRow.fiberG,
    fluidOz: itemRow.fluidOz,
    source: 'personal',
    confidence: 'stated',
    fdcId: null,
    fdcDescription: null,
    assumption,
  };
}

function fromPortionMemory(food: GenericFood, memory: PortionMemory): DraftItem {
  return {
    name: titleCase(food.key),
    quantity: memory.quantity,
    unit: memory.unit,
    calories: memory.calories,
    proteinG: memory.proteinG,
    carbsG: memory.carbsG,
    fatG: memory.fatG,
    fiberG: memory.fiberG,
    fluidOz: memory.fluidOz,
    source: 'personal',
    confidence: 'stated',
    fdcId: null,
    fdcDescription: null,
    assumption: 'Using the portion you asked to remember.',
  };
}

function splitMeals(text: string): { label: string; body: string }[] {
  const was = [...text.matchAll(/\b(breakfast|lunch|dinner)\s+was\s+(.+?)(?=(?:,|\s+and)\s+(?:breakfast|lunch|dinner)\s+was\b|$)/g)];
  if (was.length >= 1 && /\bwas\b/.test(text)) {
    return was.map((match) => ({ label: titleCase(match[1]), body: match[2].trim() }));
  }
  const marker = /\b(this morning|tonight|for breakfast|for lunch|for dinner)\b/g;
  const markers = text.match(marker) ?? [];
  if (markers.length >= 2) {
    return text.split(/\s+and\s+/).map((chunk) => {
      const found = chunk.match(/\b(this morning|tonight|for breakfast|for lunch|for dinner)\b/);
      const label = found ? labelFromMarker(found[1]) : 'Meal';
      const body = chunk.replace(/\b(this morning|tonight|for breakfast|for lunch|for dinner)\b/g, ' ').replace(/\s+/g, ' ').trim();
      return { label, body };
    });
  }
  const single = text.match(/\b(this morning|tonight|for breakfast|for lunch|for dinner)\b/);
  const label = single ? labelFromMarker(single[1]) : drinkLabel(text);
  const body = text.replace(/\b(this morning|tonight|for breakfast|for lunch|for dinner)\b/g, ' ').replace(/\s+/g, ' ').trim();
  return [{ label, body }];
}

function labelFromMarker(marker: string): string {
  if (/morning|breakfast/.test(marker)) return 'Breakfast';
  if (/lunch/.test(marker)) return 'Lunch';
  if (/dinner|tonight/.test(marker)) return 'Dinner';
  return 'Meal';
}

function drinkLabel(text: string): string {
  if (/\b(red bull|coffee|water|beer|vodka)\b/.test(text) && !/\b(eggs|burger|fries|sandwich|rice|bar|wing|pizza|burrito)\b/.test(text)) return 'Drink';
  return 'Meal';
}

function resolveWhen(text: string, now: Date): { date: string; ambiguous: boolean } {
  const today = nutritionToday(now);
  if (/yesterday|last night/.test(text)) return { date: shiftDate(today, -1), ambiguous: false };
  if (/around midnight/.test(text)) {
    return { date: today, ambiguous: !loggingClockIsBeforeGameDayStart(now) };
  }
  return { date: today, ambiguous: false };
}

function recallOrGeneric(hint: string, ctx: ParseContext, today: string, kind: 'recall'): DraftMeal {
  const found = matchMemory(hint, ctx.memory ?? []);
  if (found) {
    return {
      kind,
      mealLabel: titleCase(found.name),
      diaryDate: today,
      items: found.items.map((row) => fromMemory(row, `Matched your saved meal “${found.alias}”. No new estimate.`)),
      note: null,
      clarification: null,
      assumptions: [`Used “${found.alias}” from your saved meals.`],
      factor: null,
      setQuantity: null,
      foodHint: null,
    };
  }
  const parsed = parseMealText(hint, { ...ctx, memory: [], history: [] });
  const meal = parsed.meals[0];
  return {
    ...(meal ?? emptyLog(today)),
    kind,
    assumptions: [...(meal?.assumptions ?? []), 'No saved meal matched that name.'],
  };
}

function yesterdayBreakfast(text: string, ctx: ParseContext): DraftMeal {
  const yesterday = previousGameDay(ctx.now);
  const prior = (ctx.history ?? []).find((meal) => meal.diaryDate === yesterday && /breakfast/i.test(meal.mealLabel));
  const drop = text.match(/\bbut no\s+([a-z]+)/);
  if (!prior) {
    return {
      ...emptyLog(nutritionToday(ctx.now)),
      kind: 'recall',
      mealLabel: 'Breakfast',
      assumptions: ['No breakfast was saved for yesterday.'],
      clarification: 'What was breakfast? (optional)',
    };
  }
  const items = prior.items
    .filter((row) => !(drop && row.name.toLowerCase().includes(drop[1])))
    .map((row) => fromMemory(row, 'Copied yesterday’s breakfast.'));
  return {
    kind: 'recall',
    mealLabel: 'Breakfast',
    diaryDate: nutritionToday(ctx.now),
    items,
    note: null,
    clarification: null,
    assumptions: [drop ? `Left out ${drop[1]}.` : 'Copied yesterday’s breakfast.'],
    factor: null,
    setQuantity: null,
    foodHint: null,
  };
}

function leftover(ctx: ParseContext, fromYesterday: boolean): DraftMeal {
  const today = nutritionToday(ctx.now);
  const date = fromYesterday ? previousGameDay(ctx.now) : today;
  const prior = (ctx.history ?? []).find((meal) => meal.items.some((row) => /chicken/i.test(row.name)) && (!fromYesterday || meal.diaryDate === date));
  if (prior) {
    const chicken = prior.items.filter((row) => /chicken/i.test(row.name));
    return {
      kind: 'recall',
      mealLabel: 'Meal',
      diaryDate: today,
      items: chicken.map((row) => fromMemory(row, 'Using the earlier chicken entry as the reference.')),
      note: null,
      clarification: null,
      assumptions: ['Using the earlier chicken entry as the reference.'],
      factor: null,
      setQuantity: null,
      foodHint: null,
    };
  }
  const parsed = parseMealText('chicken', { now: ctx.now });
  return {
    ...parsed.meals[0],
    assumptions: ['No chicken entry from yesterday. Using a typical portion.'],
  };
}

function otherHalf(ctx: ParseContext): DraftMeal {
  const today = nutritionToday(ctx.now);
  const prior = [...(ctx.history ?? [])].reverse().find((meal) => meal.items.some((row) => /burrito/i.test(row.name)));
  if (prior) {
    const burrito = prior.items.find((row) => /burrito/i.test(row.name))!;
    return {
      kind: 'recall',
      mealLabel: 'Meal',
      diaryDate: today,
      items: [fromMemory(burrito, 'Using the earlier burrito as the other half.')],
      note: null,
      clarification: null,
      assumptions: ['Using the earlier burrito as the other half.'],
      factor: null,
      setQuantity: null,
      foodHint: null,
    };
  }
  const parsed = parseMealText('half a burrito', { now: ctx.now });
  return {
    ...parsed.meals[0],
    assumptions: ['No earlier burrito was found, so this is half of a typical burrito.'],
  };
}

function matchMemory(text: string, memory: readonly MemoryMeal[]): MemoryMeal | null {
  const normalized = text.toLowerCase();
  const ranked = [...memory].sort((a, b) => b.alias.length - a.alias.length);
  return ranked.find((meal) => normalized.includes(meal.alias.toLowerCase()) || meal.alias.toLowerCase().includes(normalized)) ?? null;
}

function hasExplicitQuantity(text: string): boolean {
  return /\d/.test(text) || /\bhalf\b|\bquarter\b|\bhandful|\bsplash\b|\bwhole\b|\bfew bites\b/.test(text);
}

function isExcluded(name: string, excluded: Set<string>): boolean {
  const lower = name.toLowerCase();
  for (const word of excluded) {
    if (lower.includes(word) || word.includes(lower)) return true;
  }
  return false;
}

function displayName(food: GenericFood, phrase: string): string {
  if (/chick-fil-a/.test(phrase) && /sandwich|chick-fil-a/.test(food.key + phrase)) return 'Chick-fil-A chicken sandwich';
  if (/chipotle/.test(phrase) && /burrito/.test(food.key)) return `Chipotle ${food.key}`;
  if (/pepperoni/.test(phrase) && /pizza/.test(food.key)) return 'Pepperoni pizza';
  if (/sugar[- ]free red bull/.test(phrase)) return 'Sugar-free Red Bull';
  if (food.key === 'red bull') return 'Red Bull';
  return titleCase(food.key);
}

function cleanName(text: string): string {
  return titleCase(text.replace(/^(extra|some|a lot of)\s+/, '').trim());
}

function uniqueNotes(notes: string[]): string | null {
  const unique = [...new Set(notes.map((note) => note.trim()).filter(Boolean))];
  return unique.length ? unique.join(' ') : null;
}

function blankCommand(
  kind: 'adjust' | 'remove',
  diaryDate: string,
  assumption: string,
  factor: number | null,
  setQuantity: number | null,
  foodHint: string | null,
): DraftMeal {
  return {
    kind,
    mealLabel: 'Meal',
    diaryDate,
    items: [],
    note: null,
    clarification: null,
    assumptions: [assumption],
    factor,
    setQuantity,
    foodHint,
  };
}

function emptyLog(diaryDate: string): DraftMeal {
  return {
    kind: 'log',
    mealLabel: 'Meal',
    diaryDate,
    items: [],
    note: null,
    clarification: null,
    assumptions: [],
    factor: null,
    setQuantity: null,
    foodHint: null,
  };
}

function titleCase(value: string): string {
  return value.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function trimNum(value: number): string {
  return String(Math.round(value * 100) / 100);
}
