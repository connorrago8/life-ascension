/** Diary sources. Paid AI sources stay unused while NUTRITION_PAID_AI is off. */
export type ItemSource =
  | 'usda_fdc'
  | 'ai_text'
  | 'ai_photo'
  | 'user_edited'
  | 'generic'
  | 'personal'
  | 'convention';

export type Confidence = 'stated' | 'typical' | 'low';

export type DraftItem = {
  name: string;
  quantity: number;
  unit: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number | null;
  fluidOz: number | null;
  source: ItemSource;
  confidence: Confidence;
  fdcId: number | null;
  fdcDescription: string | null;
  assumption: string | null;
};

export type MealKind = 'log' | 'adjust' | 'remove' | 'recall';

export type DraftMeal = {
  kind: MealKind;
  mealLabel: string;
  diaryDate: string;
  items: DraftItem[];
  note: string | null;
  /** At most one, and always optional. Saving does not wait on it. */
  clarification: string | null;
  assumptions: string[];
  /** adjust: multiply the last meal. remove: offer to delete the last meal. */
  factor: number | null;
  setQuantity: number | null;
  foodHint: string | null;
};

export type MemoryItem = {
  name: string;
  quantity: number;
  unit: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number | null;
  fluidOz: number | null;
};

export type MemoryMeal = {
  alias: string;
  name: string;
  items: MemoryItem[];
};

export type HistoryMeal = {
  diaryDate: string;
  mealLabel: string;
  items: MemoryItem[];
};

export type PortionMemory = {
  foodKey: string;
  quantity: number;
  unit: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number | null;
  fluidOz: number | null;
};

export type ParseContext = {
  now: Date;
  memory?: readonly MemoryMeal[];
  history?: readonly HistoryMeal[];
  portions?: readonly PortionMemory[];
};

export const MEAL_XP = 0;

export function sourceBadge(source: ItemSource): string {
  if (source === 'usda_fdc') return 'USDA match';
  if (source === 'ai_text' || source === 'ai_photo') return 'AI estimate';
  if (source === 'user_edited') return 'You entered';
  if (source === 'personal') return 'Saved meal';
  return 'Estimate, you can edit this';
}
