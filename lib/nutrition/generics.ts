/**
 * Typical values used only when the user did not give a label and USDA
 * did not match. They are labeled estimates, not restaurant facts.
 * Chain menus are intentionally not hardcoded.
 */
export type GenericFood = {
  key: string;
  aliases: string[];
  servingQty: number;
  servingUnit: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number | null;
  fluidOz: number | null;
  assumption?: string;
  brandPrompt?: boolean;
};

export const GENERIC_FOODS: readonly GenericFood[] = [
  { key: 'sugar-free red bull', aliases: ['sugar-free red bull', 'sugar free red bull'], servingQty: 1, servingUnit: 'can', calories: 10, proteinG: 0, carbsG: 1, fatG: 0, fiberG: 0, fluidOz: 8.4, assumption: 'Typical 8.4 fl oz sugar-free can. Not a scanned label.' },
  { key: 'red bull', aliases: ['red bull'], servingQty: 1, servingUnit: 'can', calories: 110, proteinG: 0, carbsG: 27, fatG: 0, fiberG: 0, fluidOz: 8.4, assumption: 'Typical 8.4 fl oz can. Not a scanned label.' },
  { key: 'protein powder', aliases: ['protein powder'], servingQty: 1, servingUnit: 'scoop', calories: 120, proteinG: 24, carbsG: 3, fatG: 1, fiberG: 0, fluidOz: null, brandPrompt: true, assumption: 'One typical scoop. Brand was not used.' },
  { key: 'protein shake', aliases: ['protein shake'], servingQty: 1, servingUnit: 'shake', calories: 160, proteinG: 30, carbsG: 8, fatG: 3, fiberG: 1, fluidOz: 11, brandPrompt: true, assumption: 'Typical ready-to-drink or mixed shake.' },
  { key: 'protein bar', aliases: ['protein bar'], servingQty: 1, servingUnit: 'bar', calories: 200, proteinG: 20, carbsG: 22, fatG: 7, fiberG: 3, fluidOz: null, brandPrompt: true, assumption: 'Typical bar. Brand was not used.' },
  { key: 'chicken sandwich', aliases: ['chicken sandwich', 'chick-fil-a sandwich', 'chick-fil-a'], servingQty: 1, servingUnit: 'sandwich', calories: 450, proteinG: 32, carbsG: 42, fatG: 16, fiberG: 2, fluidOz: null, assumption: 'Typical chicken sandwich. Not an official restaurant label.' },
  { key: 'chicken pasta', aliases: ['chicken pasta', 'izzy chicken pasta'], servingQty: 1, servingUnit: 'plate', calories: 700, proteinG: 40, carbsG: 75, fatG: 22, fiberG: 4, fluidOz: null, assumption: 'Homemade plate. Portions are approximate.' },
  { key: 'chicken breast', aliases: ['chicken breast'], servingQty: 1, servingUnit: 'oz', calories: 47, proteinG: 9, carbsG: 0, fatG: 1, fiberG: 0, fluidOz: null, assumption: 'About 1 cooked ounce.' },
  { key: 'chicken', aliases: ['chicken'], servingQty: 4, servingUnit: 'oz', calories: 188, proteinG: 36, carbsG: 0, fatG: 4, fiberG: 0, fluidOz: null, assumption: 'About 4 cooked ounces.' },
  { key: 'burrito bowl', aliases: ['burrito bowl'], servingQty: 1, servingUnit: 'bowl', calories: 700, proteinG: 40, carbsG: 72, fatG: 22, fiberG: 10, fluidOz: null, assumption: 'Typical bowl. Not a restaurant official label.' },
  { key: 'burrito', aliases: ['burrito'], servingQty: 1, servingUnit: 'burrito', calories: 800, proteinG: 35, carbsG: 90, fatG: 28, fiberG: 8, fluidOz: null, assumption: 'Typical burrito. Not a restaurant official label.' },
  { key: 'vodka soda', aliases: ['vodka soda'], servingQty: 1, servingUnit: 'drink', calories: 100, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, fluidOz: 8, assumption: 'Vodka and soda water. No sugary mixer added.' },
  { key: 'frozen pizza', aliases: ['frozen pizza'], servingQty: 1, servingUnit: 'pizza', calories: 2280, proteinG: 96, carbsG: 288, fatG: 80, fiberG: 16, fluidOz: null, assumption: 'Whole pizza counted as 8 typical slices, not one labeled serving.' },
  { key: 'pepperoni pizza', aliases: ['pepperoni pizza'], servingQty: 1, servingUnit: 'slice', calories: 300, proteinG: 13, carbsG: 36, fatG: 12, fiberG: 2, fluidOz: null, assumption: 'One typical slice.' },
  { key: 'pizza', aliases: ['pizza'], servingQty: 1, servingUnit: 'slice', calories: 285, proteinG: 12, carbsG: 36, fatG: 10, fiberG: 2, fluidOz: null, assumption: 'One typical slice.' },
  { key: 'french fries', aliases: ['french fries', 'fries'], servingQty: 1, servingUnit: 'serving', calories: 370, proteinG: 4, carbsG: 48, fatG: 17, fiberG: 4, fluidOz: null, assumption: 'One typical restaurant serving.' },
  { key: 'hamburger', aliases: ['hamburger', 'burger'], servingQty: 1, servingUnit: 'burger', calories: 550, proteinG: 30, carbsG: 42, fatG: 28, fiberG: 2, fluidOz: null, assumption: 'Restaurant burger with a bun, unless you said otherwise.' },
  { key: 'chicken salad', aliases: ['chicken salad'], servingQty: 1, servingUnit: 'bowl', calories: 350, proteinG: 28, carbsG: 12, fatG: 20, fiberG: 3, fluidOz: null, assumption: 'Chicken salad without dressing added on the side.' },
  { key: 'salad', aliases: ['salad'], servingQty: 1, servingUnit: 'bowl', calories: 120, proteinG: 3, carbsG: 10, fatG: 7, fiberG: 3, fluidOz: null, assumption: 'A simple salad. Ingredients were not listed.' },
  { key: 'sushi', aliases: ['sushi'], servingQty: 8, servingUnit: 'piece', calories: 320, proteinG: 16, carbsG: 48, fatG: 6, fiberG: 1, fluidOz: null, assumption: 'Assumed 8 pieces. You can edit this.' },
  { key: 'white rice', aliases: ['white rice', 'rice'], servingQty: 1, servingUnit: 'cup', calories: 206, proteinG: 4, carbsG: 45, fatG: 0, fiberG: 1, fluidOz: null },
  { key: 'broccoli', aliases: ['broccoli'], servingQty: 1, servingUnit: 'cup', calories: 55, proteinG: 4, carbsG: 11, fatG: 1, fiberG: 5, fluidOz: null },
  { key: 'pasta', aliases: ['pasta'], servingQty: 1, servingUnit: 'plate', calories: 300, proteinG: 10, carbsG: 58, fatG: 3, fiberG: 3, fluidOz: null, assumption: 'A typical plate of pasta.' },
  { key: 'parmesan', aliases: ['parmesan'], servingQty: 1, servingUnit: 'tbsp', calories: 22, proteinG: 2, carbsG: 0, fatG: 1, fiberG: 0, fluidOz: null },
  { key: 'mayonnaise', aliases: ['mayonnaise', 'mayo'], servingQty: 1, servingUnit: 'tbsp', calories: 90, proteinG: 0, carbsG: 0, fatG: 10, fiberG: 0, fluidOz: null },
  { key: 'butter', aliases: ['butter'], servingQty: 1, servingUnit: 'tbsp', calories: 102, proteinG: 0, carbsG: 0, fatG: 12, fiberG: 0, fluidOz: null },
  { key: 'toast', aliases: ['toast'], servingQty: 1, servingUnit: 'slice', calories: 80, proteinG: 3, carbsG: 14, fatG: 1, fiberG: 1, fluidOz: null },
  { key: 'egg', aliases: ['eggs', 'egg'], servingQty: 1, servingUnit: 'large', calories: 72, proteinG: 6, carbsG: 0, fatG: 5, fiberG: 0, fluidOz: null },
  { key: 'potato chips', aliases: ['chips'], servingQty: 1, servingUnit: 'oz', calories: 150, proteinG: 2, carbsG: 15, fatG: 10, fiberG: 1, fluidOz: null },
  { key: 'almonds', aliases: ['almonds', 'almond'], servingQty: 1, servingUnit: 'oz', calories: 164, proteinG: 6, carbsG: 6, fatG: 14, fiberG: 4, fluidOz: null },
  { key: 'beer', aliases: ['beers', 'beer'], servingQty: 1, servingUnit: 'can', calories: 150, proteinG: 1, carbsG: 13, fatG: 0, fiberG: 0, fluidOz: 12 },
  { key: 'chicken wing', aliases: ['wings', 'wing'], servingQty: 1, servingUnit: 'piece', calories: 90, proteinG: 8, carbsG: 0, fatG: 6, fiberG: 0, fluidOz: null },
  { key: 'dessert', aliases: ['dessert'], servingQty: 1, servingUnit: 'serving', calories: 300, proteinG: 4, carbsG: 40, fatG: 14, fiberG: 1, fluidOz: null, assumption: 'A typical dessert serving.' },
  { key: 'coffee', aliases: ['coffee'], servingQty: 8, servingUnit: 'fl oz', calories: 2, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, fluidOz: 8, assumption: 'Black coffee.' },
  { key: 'cream', aliases: ['cream'], servingQty: 1, servingUnit: 'tbsp', calories: 20, proteinG: 0, carbsG: 0, fatG: 2, fiberG: 0, fluidOz: 0.5 },
  { key: 'milk', aliases: ['milk'], servingQty: 1, servingUnit: 'tbsp', calories: 9, proteinG: 0, carbsG: 1, fatG: 1, fiberG: 0, fluidOz: 0.5, assumption: 'A splash is about 1 tbsp, not a glass.' },
  { key: 'water', aliases: ['water'], servingQty: 1, servingUnit: 'glass', calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, fluidOz: 8, assumption: 'Volume was not stated. One 8 fl oz glass is a placeholder you can edit.' },
];

const BY_LENGTH = [...GENERIC_FOODS].sort((a, b) => {
  const al = Math.max(...a.aliases.map((alias) => alias.length));
  const bl = Math.max(...b.aliases.map((alias) => alias.length));
  return bl - al;
});

export function matchGeneric(phrase: string): { food: GenericFood; alias: string } | null {
  const text = phrase.toLowerCase();
  let best: { food: GenericFood; alias: string; index: number } | null = null;
  for (const food of BY_LENGTH) {
    for (const alias of food.aliases) {
      const index = text.indexOf(alias);
      if (index < 0) continue;
      if (!best || index < best.index || (index === best.index && alias.length > best.alias.length)) {
        best = { food, alias, index };
      }
    }
  }
  return best ? { food: best.food, alias: best.alias } : null;
}

export function peelKnownFoods(phrase: string): string[] {
  let rest = phrase.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  const found: string[] = [];
  while (rest) {
    let best: { alias: string; index: number } | null = null;
    for (const food of GENERIC_FOODS) {
      for (const alias of food.aliases) {
        const index = rest.indexOf(alias);
        if (index < 0) continue;
        if (!best || index < best.index || (index === best.index && alias.length > best.alias.length)) {
          best = { alias, index };
        }
      }
    }
    if (!best) break;
    found.push(best.alias);
    rest = `${rest.slice(0, best.index)} ${rest.slice(best.index + best.alias.length)}`.replace(/\s+/g, ' ').trim();
  }
  return found;
}
