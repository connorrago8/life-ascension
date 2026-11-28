import type { DraftItem } from './types.ts';

export type FdcNutrient = { nutrientId?: number; nutrientName?: string; value?: number; amount?: number; nutrient?: { id?: number; name?: string } };
export type FdcPortion = { gramWeight?: number; modifier?: string; portionDescription?: string; measureUnit?: { name?: string } };
export type FdcFood = { fdcId: number; description: string; foodNutrients?: FdcNutrient[]; foodPortions?: FdcPortion[] };

const ENERGY = [1008, 2047, 2048];
const PROTEIN = [1003];
const CARBS = [1005];
const FAT = [1004];
const FIBER = [1079];

const GRAMS: Record<string, number> = {
  g: 1, gram: 1, grams: 1,
  oz: 28.3495, ounce: 28.3495, ounces: 28.3495,
  lb: 453.592, lbs: 453.592, pound: 453.592,
  tbsp: 15, tablespoon: 15,
  tsp: 5, teaspoon: 5,
  'fl oz': 29.5735,
  cup: 240,
  large: 50,
};

export function clearFdcMatch(query: string, description: string): boolean {
  const skip = new Set(['with', 'and', 'the', 'from', 'food', 'raw', 'cooked']);
  const words = query.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 2 && !skip.has(word));
  if (words.length === 0) return false;
  const desc = description.toLowerCase();
  const hits = words.filter((word) => desc.includes(word));
  return hits.length >= 1 && hits.length / words.length >= 0.5;
}

/** Use USDA per-100 g values when the portion converts cleanly. Otherwise keep the labeled estimate. */
export function applyFdcFood(item: DraftItem, food: FdcFood): DraftItem | null {
  if (!clearFdcMatch(item.name, food.description)) return null;
  const per100 = {
    calories: nutrient(food, ENERGY),
    proteinG: nutrient(food, PROTEIN),
    carbsG: nutrient(food, CARBS),
    fatG: nutrient(food, FAT),
    fiberG: nutrient(food, FIBER),
  };
  if (per100.calories === null || per100.proteinG === null || per100.carbsG === null || per100.fatG === null) return null;
  const grams = gramsFor(item, food.foodPortions ?? []);
  if (grams === null) return null;
  const factor = grams / 100;
  return {
    ...item,
    calories: round1(per100.calories * factor),
    proteinG: round1(per100.proteinG * factor),
    carbsG: round1(per100.carbsG * factor),
    fatG: round1(per100.fatG * factor),
    fiberG: per100.fiberG === null ? item.fiberG : round1(per100.fiberG * factor),
    source: 'usda_fdc',
    fdcId: food.fdcId,
    fdcDescription: food.description.slice(0, 180),
    assumption: item.assumption,
  };
}

export async function searchFdc(query: string, apiKey: string, fetchImpl: typeof fetch, signal?: AbortSignal): Promise<FdcFood | null> {
  const url = new URL('https://api.nal.usda.gov/fdc/v1/foods/search');
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('query', query);
  url.searchParams.set('pageSize', '3');
  url.searchParams.set('dataType', 'Foundation,SR Legacy');
  const response = await fetchImpl(url, { signal });
  if (!response.ok) return null;
  const body = await response.json() as { foods?: FdcFood[] };
  const hit = (body.foods ?? []).find((food) => food?.fdcId && clearFdcMatch(query, food.description ?? ''));
  if (!hit) return null;
  try {
    const detailUrl = new URL(`https://api.nal.usda.gov/fdc/v1/food/${hit.fdcId}`);
    detailUrl.searchParams.set('api_key', apiKey);
    const detail = await fetchImpl(detailUrl, { signal });
    if (!detail.ok) return hit;
    const full = await detail.json() as FdcFood;
    return { ...hit, ...full, fdcId: hit.fdcId, description: full.description || hit.description };
  } catch {
    return hit;
  }
}

function nutrient(food: FdcFood, ids: number[]): number | null {
  for (const row of food.foodNutrients ?? []) {
    const id = row.nutrientId ?? row.nutrient?.id;
    if (id === undefined || !ids.includes(id)) continue;
    const amount = row.value ?? row.amount;
    if (typeof amount === 'number' && Number.isFinite(amount)) return amount;
  }
  return null;
}

function gramsFor(item: DraftItem, portions: FdcPortion[]): number | null {
  const unit = item.unit.toLowerCase();
  if (GRAMS[unit]) return item.quantity * GRAMS[unit];
  const portion = portions.find((row) => {
    const label = `${row.modifier ?? ''} ${row.portionDescription ?? ''} ${row.measureUnit?.name ?? ''}`.toLowerCase();
    return label.includes(unit) && typeof row.gramWeight === 'number';
  });
  if (portion?.gramWeight) return item.quantity * portion.gramWeight;
  if ((unit === 'piece' || unit === 'large' || unit === 'serving') && portions.length === 1 && portions[0].gramWeight) {
    return item.quantity * portions[0].gramWeight;
  }
  return null;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
