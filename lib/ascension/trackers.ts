export const meals = ['Breakfast', 'Lunch', 'Dinner'] as const;
export const paydayFields = [
  ['cash', 'Available cash after deposit'],
  ['obligations', 'Essentials, pending debits and minimums before next payday'],
  ['reserved', 'Cash already reserved for promos'],
  ['used', 'Extra payments already made this month'],
  ['promo', 'Verified next promo balance'],
  ['expected', 'Planned payments expected to reach that promo'],
  ['promoReserved', 'Cash reserved for this specific promo'],
] as const;

export function paydaySummary(values: Record<string, string>) {
  const amounts = paydayFields.map(([key]) => {
    const input = values[key]?.trim();
    return input && /^\d+(\.\d{1,2})?$/.test(input) && Number(input) <= 1e9
      ? Math.round(Number(input) * 100)
      : null;
  });
  const [cash, obligations, reserved, used, promo, expected, promoReserved] = amounts;
  const safe = cash === null || obligations === null || reserved === null || used === null
    ? null : Math.max(0, Math.min(120000 - used, cash - obligations - reserved - 1000000));
  const shortfall = cash === null || obligations === null ? null : Math.max(0, obligations - cash);
  const gap = promo === null || expected === null || promoReserved === null
    ? null : Math.max(0, promo - expected - promoReserved);
  return { safe, shortfall, gap };
}

export function shiftDate(date: string, days: number) {
  const value = new Date(date + 'T12:00:00Z');
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export const paydays = Array.from({ length: 13 }, (_, index) => shiftDate('2026-12-03', index * 14));
