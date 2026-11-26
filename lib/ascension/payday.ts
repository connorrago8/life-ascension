import { FINANCE_DECISIONS, PAYDAY_END, PAYDAY_INTERVAL_DAYS, PAYDAY_START, type FinanceDecision } from './config.ts';
import { shiftDate } from './dates.ts';

export function paydayDates(): string[] {
  const dates: string[] = [];
  for (let day = PAYDAY_START; day <= PAYDAY_END; day = shiftDate(day, PAYDAY_INTERVAL_DAYS)) dates.push(day);
  return dates;
}

export function isPayday(date: string): boolean {
  return paydayDates().includes(date);
}

export function isFinanceDecision(value: string): value is FinanceDecision {
  return (FINANCE_DECISIONS as readonly string[]).includes(value);
}

/** Every decision uses the same quest-credit path. The choice does not change the award. */
export function paydayCreditVariesByDecision(): boolean {
  return false;
}
