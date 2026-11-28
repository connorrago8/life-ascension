import { shiftDate } from '../ascension/dates.ts';
import { weekStart } from '../questStreak.ts';
import type { DraftItem } from './types.ts';

export type NutrientLine = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number | null;
  fluidOz: number;
};

export type DiaryRow = NutrientLine & {
  diaryDate: string;
  mealLabel: string;
};

export function sumLines(rows: readonly NutrientLine[]): NutrientLine {
  let fiberKnown = false;
  const total = rows.reduce<NutrientLine>((sum, row) => {
    if (row.fiberG !== null) fiberKnown = true;
    return {
      calories: round1(sum.calories + row.calories),
      proteinG: round1(sum.proteinG + row.proteinG),
      carbsG: round1(sum.carbsG + row.carbsG),
      fatG: round1(sum.fatG + row.fatG),
      fiberG: round1((sum.fiberG ?? 0) + (row.fiberG ?? 0)),
      fluidOz: round1(sum.fluidOz + row.fluidOz),
    };
  }, { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, fluidOz: 0 });
  if (!fiberKnown) total.fiberG = null;
  return total;
}

export function itemsToLine(items: readonly Pick<DraftItem, 'calories' | 'proteinG' | 'carbsG' | 'fatG' | 'fiberG' | 'fluidOz'>[]): NutrientLine {
  return sumLines(items.map((item) => ({
    calories: item.calories,
    proteinG: item.proteinG,
    carbsG: item.carbsG,
    fatG: item.fatG,
    fiberG: item.fiberG,
    fluidOz: item.fluidOz ?? 0,
  })));
}

export function overview(rows: readonly DiaryRow[]): { meals: number; proteinG: number; fluidOz: number } {
  return {
    meals: rows.length,
    proteinG: round1(rows.reduce((sum, row) => sum + row.proteinG, 0)),
    fluidOz: round1(rows.reduce((sum, row) => sum + row.fluidOz, 0)),
  };
}

export type HistoryRollup = {
  days: { diaryDate: string; meals: number; proteinG: number; fluidOz: number; calories: number }[];
  week: NutrientLine & { meals: number };
  month: NutrientLine & { meals: number };
};

export function rollupHistory(rows: readonly DiaryRow[], today: string): HistoryRollup {
  const weekBegin = weekStart(today);
  const month = today.slice(0, 7);
  const byDay = new Map<string, DiaryRow[]>();
  for (const row of rows) {
    const list = byDay.get(row.diaryDate) ?? [];
    list.push(row);
    byDay.set(row.diaryDate, list);
  }
  const days = [...byDay.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([diaryDate, group]) => {
      const line = sumLines(group);
      return { diaryDate, meals: group.length, proteinG: line.proteinG, fluidOz: line.fluidOz, calories: line.calories };
    });
  const weekRows = rows.filter((row) => row.diaryDate >= weekBegin && row.diaryDate <= shiftDate(weekBegin, 6));
  const monthRows = rows.filter((row) => row.diaryDate.startsWith(month));
  return {
    days,
    week: { meals: weekRows.length, ...sumLines(weekRows) },
    month: { meals: monthRows.length, ...sumLines(monthRows) },
  };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
