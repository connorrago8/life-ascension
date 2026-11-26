import { createHash } from 'node:crypto';

export type ParsedTransaction = {
  date: string;
  merchant: string;
  category: string;
  accountLabel: string;
  amount: number;
};

export type CsvPreview = {
  rows: ParsedTransaction[];
  rowCount: number;
  dateStart: string;
  dateEnd: string;
};

const REQUIRED = ['date', 'merchant', 'category', 'account', 'original statement', 'notes', 'amount', 'tags'];

/** Mask a digit run of 6 or more, ignoring single spaces and dashes inside the run. */
export function maskAccountLabel(label: string): string {
  const value = label.trim().slice(0, 120);
  if (!value) return 'Account';
  let out = '';
  let index = 0;
  while (index < value.length) {
    const ch = value[index];
    if (ch >= '0' && ch <= '9') {
      const start = index;
      let digits = '';
      while (index < value.length) {
        const next = value[index];
        if (next >= '0' && next <= '9') {
          digits += next;
          index += 1;
        } else if ((next === ' ' || next === '-') && index + 1 < value.length && value[index + 1] >= '0' && value[index + 1] <= '9' && digits.length > 0) {
          index += 1;
        } else {
          break;
        }
      }
      out += digits.length >= 6 ? `••••${digits.slice(-4)}` : value.slice(start, index);
    } else {
      out += ch;
      index += 1;
    }
  }
  return out.slice(0, 120);
}

export function formatAmount(amount: number): string {
  return amount.toFixed(2);
}

/** Same canonical string as public.finance_content_hash for a CSV row. */
export function csvContentKey(row: ParsedTransaction): string {
  const account = maskAccountLabel(row.accountLabel);
  return [
    'csv',
    '',
    row.date,
    row.merchant.trim().toLowerCase(),
    row.category.trim().toLowerCase(),
    account.trim().toLowerCase(),
    formatAmount(row.amount),
    '0',
  ].join('|');
}

export function csvRowHash(row: ParsedTransaction): string {
  return createHash('sha256').update(csvContentKey(row), 'utf8').digest('hex');
}

export function dedupeCsvRows(rows: readonly ParsedTransaction[]): ParsedTransaction[] {
  const seen = new Set<string>();
  const kept: ParsedTransaction[] = [];
  for (const row of rows) {
    const hash = csvRowHash(row);
    if (seen.has(hash)) continue;
    seen.add(hash);
    kept.push(row);
  }
  return kept;
}

export function parseAmount(raw: string): number | null {
  let text = raw.trim();
  if (!text) return null;
  let negative = false;
  if (text.startsWith('(') && text.endsWith(')')) {
    negative = true;
    text = text.slice(1, -1).trim();
  }
  text = text.replace(/[$,\s]/g, '');
  if (text.startsWith('+')) text = text.slice(1);
  if (text.startsWith('-')) {
    negative = true;
    text = text.slice(1);
  }
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  const value = Number(text);
  if (!Number.isFinite(value)) return null;
  const signed = negative ? -value : value;
  return Math.round(signed * 100) / 100;
}

export function parseCsvDate(raw: string): string | null {
  const text = raw.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (iso) return calendar(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (us) return calendar(Number(us[3]), Number(us[1]), Number(us[2]));
  return null;
}

function calendar(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return null;
  return parsed.toISOString().slice(0, 10);
}

/** RFC-style CSV. Quoted fields may contain commas and doubled quotes. */
export function parseCsvTable(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const ch = source[index];
    if (quoted) {
      if (ch === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      continue;
    }
    if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }
    field += ch;
  }
  if (quoted) throw new Error('CSV quote was not closed');
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ''));
}

export function parseMonarchCsv(text: string): CsvPreview {
  if (text.length > 1_500_000) throw new Error('CSV is too large');
  const table = parseCsvTable(text);
  if (table.length < 2) throw new Error('CSV needs a header and one row');
  const header = table[0].map((cell) => cell.trim().toLowerCase());
  const index = new Map<string, number>();
  header.forEach((name, position) => {
    if (!index.has(name)) index.set(name, position);
  });
  for (const name of REQUIRED) {
    if (!index.has(name)) throw new Error('CSV is missing a Monarch column');
  }
  const rows: ParsedTransaction[] = [];
  for (const cells of table.slice(1)) {
    const cell = (name: string) => cells[index.get(name) ?? -1] ?? '';
    const date = parseCsvDate(cell('date'));
    const amount = parseAmount(cell('amount'));
    if (!date || amount === null) throw new Error('CSV row has a bad date or amount');
    const merchant = cell('merchant').trim().slice(0, 200) || 'Unknown';
    const category = cell('category').trim().slice(0, 120) || 'Uncategorized';
    rows.push({
      date,
      merchant,
      category,
      accountLabel: cell('account'),
      amount,
    });
  }
  if (rows.length > 2000) throw new Error('CSV has too many rows');
  const dates = rows.map((row) => row.date).sort();
  return { rows, rowCount: rows.length, dateStart: dates[0], dateEnd: dates[dates.length - 1] };
}
