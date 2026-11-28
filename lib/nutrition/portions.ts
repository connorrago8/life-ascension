/**
 * Editable portion conventions. These are not measurements and not advice
 * about how much to eat. A splash of milk is not a handful of almonds.
 */
export type PortionHit = {
  quantity: number;
  unit: string;
  confidence: 'stated' | 'typical' | 'low';
  assumption: string;
  /** Remainder of the phrase after the portion words are removed. */
  rest: string;
};

const SMALL = new Set(['milk', 'cream', 'creamer', 'oil', 'sauce', 'dressing', 'syrup', 'honey']);

export function matchPortion(phrase: string, foodHint: string): PortionHit | null {
  const text = phrase.trim().toLowerCase();
  const food = foodHint.toLowerCase();

  const range = text.match(/\b(\d+(?:\.\d+)?)\s+or\s+(\d+(?:\.\d+)?)\s*(ounces|ounce|oz)\b(?:\s+of\s+(.+))?/);
  if (range) {
    const mid = (Number(range[1]) + Number(range[2])) / 2;
    return {
      quantity: mid,
      unit: 'oz',
      confidence: 'low',
      assumption: `Used ${trimNum(mid)} oz, the middle of ${range[1]}–${range[2]} oz.`,
      rest: range[4] ?? food,
    };
  }

  const half = text.match(/^(?:the other )?half(?:\s+of)?(?:\s+(?:a|an|my))?\s+(.+)$/);
  if (half) {
    return { quantity: 0.5, unit: 'serving', confidence: 'typical', assumption: 'Counted half of one serving.', rest: half[1] };
  }
  if (/^a quarter(?:\s+of)?(?:\s+(?:a|an))?\s+/.test(text)) {
    const rest = text.replace(/^a quarter(?:\s+of)?(?:\s+(?:a|an))?\s+/, '');
    return { quantity: 0.25, unit: 'serving', confidence: 'typical', assumption: 'Counted a quarter of one serving.', rest };
  }

  const handful = text.match(/^(a couple handfuls|couple handfuls|two handfuls|a small handful|a handful|handful)(?:\s+of)?\s+(.+)$/);
  if (handful) {
    const kind = handful[1];
    const multiplier = /couple|two/.test(kind) ? 2 : /small/.test(kind) ? 0.5 : 1;
    const base = handfulFor(handful[2]);
    return {
      quantity: round3(base.quantity * multiplier),
      unit: base.unit,
      confidence: 'low',
      assumption: base.note(multiplier, kind),
      rest: handful[2],
    };
  }

  const splash = text.match(/^(a splash|splash|a drizzle|drizzle|a dollop|dollop|a spoonful|spoonful)(?:\s+of)?\s+(.+)$/);
  if (splash) {
    const word = splash[1];
    const rest = splash[2];
    const unit = /drizzle/.test(word) ? 'tsp' : 'tbsp';
    const amount = /drizzle/.test(word) ? '1 tsp' : '1 tbsp';
    return {
      quantity: 1,
      unit,
      confidence: 'low',
      assumption: `A ${word.replace(/^a /, '')} of ${rest} is about ${amount}. You can edit this.`,
      rest,
    };
  }

  if (/^a few bites(?:\s+of)?\s+/.test(text)) {
    const rest = text.replace(/^a few bites(?:\s+of)?\s+/, '');
    return {
      quantity: 0.25,
      unit: 'serving',
      confidence: 'low',
      assumption: 'A few bites is about a quarter of one serving. You can edit this.',
      rest,
    };
  }

  const whole = text.match(/^a whole\s+(.+)$/);
  if (whole) {
    return {
      quantity: 1,
      unit: 'whole',
      confidence: 'low',
      assumption: 'Counted the whole package, not one labeled serving. You can edit this.',
      rest: whole[1],
    };
  }

  const measured = text.match(/^(\d+(?:\.\d+)?)\s*(g|grams|gram|oz|ounces|ounce|tbsp|tsp|cups|cup|ml)\s+(?:of\s+)?(.+)$/);
  if (measured) {
    const unit = /gram|^g$/.test(measured[2]) ? 'g' : measured[2];
    return { quantity: Number(measured[1]), unit, confidence: 'stated', assumption: '', rest: measured[3] };
  }

  const words: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8 };
  const wordCount = text.match(/^(one|two|three|four|five|six|seven|eight)\s+(.+)$/);
  if (wordCount && !/handful/.test(wordCount[0])) {
    return { quantity: words[wordCount[1]], unit: 'count', confidence: 'stated', assumption: '', rest: wordCount[2] };
  }

  const count = text.match(/^(\d+(?:\.\d+)?)\s+(.+)$/);
  if (count) {
    return {
      quantity: Number(count[1]),
      unit: 'count',
      confidence: 'stated',
      assumption: '',
      rest: count[2],
    };
  }

  if (/\ba lot of\b/.test(text)) {
    const rest = text.replace(/^.*\ba lot of\s+/, '');
    return {
      quantity: 3,
      unit: 'tbsp',
      confidence: 'low',
      assumption: `“A lot” of ${rest} is uncertain. Counted 3 tablespoons.`,
      rest,
    };
  }

  if (/^some\s+/.test(text)) {
    const rest = text.replace(/^some\s+/, '');
    const wings = /wing/.test(rest);
    return {
      quantity: wings ? 6 : 1,
      unit: wings ? 'piece' : 'serving',
      confidence: 'low',
      assumption: wings ? 'Assumed 6 wings.' : `“Some” ${rest} has no exact amount. Counted one typical serving.`,
      rest,
    };
  }

  if (SMALL.has(food) && /\bsplash\b/.test(text)) {
    return { quantity: 1, unit: 'tbsp', confidence: 'low', assumption: `A splash of ${food} is about 1 tbsp.`, rest: food };
  }

  return null;
}

function handfulFor(food: string): { quantity: number; unit: string; note: (times: number, phrase: string) => string } {
  if (/almond|nut|peanut/.test(food)) {
    return {
      quantity: 1,
      unit: 'oz',
      note: (times) => `A handful of ${food} is about 1 oz${times === 1 ? '' : `, counted ${trimNum(times)} oz`}. You can edit this.`,
    };
  }
  if (/chip|crisp|pretzel/.test(food)) {
    return {
      quantity: 1,
      unit: 'oz',
      note: (times) => `A handful of ${food} is about 1 oz${times === 1 ? '' : `, counted ${trimNum(times)} oz`}. You can edit this.`,
    };
  }
  return {
    quantity: 0.25,
    unit: 'cup',
    note: (times) => `A handful is about 1/4 cup${times === 1 ? '' : `, counted ${trimNum(times * 0.25)} cup`}. You can edit this.`,
  };
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function trimNum(value: number): string {
  return String(Math.round(value * 100) / 100);
}
