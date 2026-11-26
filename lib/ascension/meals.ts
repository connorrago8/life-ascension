export type MealFlags = {
  balanced: boolean | null;
  protein: boolean | null;
  produce: boolean | null;
  delivery: boolean | null;
};

export const BLANK_MEAL: MealFlags = { balanced: null, protein: null, produce: null, delivery: null };

/** A blank meal has every flag unset. An explicit yes or no is a log and still awards 0 XP. */
export function mealIsLogged(flags: MealFlags): boolean {
  return [flags.balanced, flags.protein, flags.produce, flags.delivery].some((flag) => flag !== null);
}
