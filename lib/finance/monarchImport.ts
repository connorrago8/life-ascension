import { createHash } from 'node:crypto';

export const FINANCE_IMPORT_PATH = '/api/finance/transactions/import';
export const FINANCE_IMPORT_SOURCE = 'monarch_mcp';
export const FINANCE_TOKEN_PATTERN = /^la_fin_[0-9a-f]{64}$/;

export const FINANCE_IMPORT_LIMITS = {
  maxRows: 2000,
  maxBytes: 1_500_000,
  perHour: 30,
} as const;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const REALM = 'Bearer realm="life-ascension"';

export type MonarchTransaction = {
  id: string;
  date: string;
  merchant: string;
  category: string;
  account_label: string;
  amount: number;
  pending: boolean;
};

export type MonarchImportBody = {
  request_id: string;
  source: typeof FINANCE_IMPORT_SOURCE;
  transactions: MonarchTransaction[];
};

export type ImportResult = {
  ok: true;
  replayed: boolean;
  request_id: string;
  inserted: number;
  updated: number;
  unchanged: number;
  verification: Record<string, unknown>;
};

type ImportDeps = {
  importRows: (tokenHash: string, body: MonarchImportBody) => Promise<
    | { ok: true; result: ImportResult }
    | { ok: false; status: number; error: string }
  >;
};

const SAFE_ERRORS = new Map<string, number>([
  ['Invalid or revoked finance token', 401],
  ['Too many finance imports', 429],
  ['Too many transactions', 400],
  ['Invalid finance import', 400],
  ['Finance import is owner-only', 403],
  ['Sign-in required', 401],
]);

export function hashFinanceToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function parseMonarchImport(body: unknown): { ok: true; value: MonarchImportBody } | { ok: false; error: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'Invalid finance import' };
  const record = body as Record<string, unknown>;
  if (typeof record.request_id !== 'string' || !UUID_PATTERN.test(record.request_id)) return { ok: false, error: 'Invalid finance import' };
  if (record.source !== FINANCE_IMPORT_SOURCE) return { ok: false, error: 'Invalid finance import' };
  if (!Array.isArray(record.transactions) || record.transactions.length > FINANCE_IMPORT_LIMITS.maxRows) {
    return { ok: false, error: 'Too many transactions' };
  }
  const transactions: MonarchTransaction[] = [];
  for (const item of record.transactions) {
    const row = parseRow(item);
    if (!row) return { ok: false, error: 'Invalid finance import' };
    transactions.push(row);
  }
  return { ok: true, value: { request_id: record.request_id, source: FINANCE_IMPORT_SOURCE, transactions } };
}

function parseRow(item: unknown): MonarchTransaction | null {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
  const row = item as Record<string, unknown>;
  if (typeof row.id !== 'string') return null;
  const id = row.id.trim();
  if (id.length < 1 || id.length > 200 || /[\u0000-\u001F\u007F]/.test(id)) return null;
  if (typeof row.date !== 'string' || !DATE_PATTERN.test(row.date) || !isCalendar(row.date)) return null;
  if (typeof row.merchant !== 'string' || typeof row.category !== 'string' || typeof row.account_label !== 'string') return null;
  if (row.merchant.length > 200 || row.category.length > 120 || row.account_label.length > 160) return null;
  if (typeof row.amount !== 'number' || !Number.isFinite(row.amount) || row.amount <= -100000000 || row.amount >= 100000000) return null;
  if (row.pending !== undefined && typeof row.pending !== 'boolean') return null;
  return {
    id,
    date: row.date,
    merchant: row.merchant,
    category: row.category,
    account_label: row.account_label,
    amount: Math.round(row.amount * 100) / 100,
    pending: row.pending === true,
  };
}

function isCalendar(value: string): boolean {
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

export function financeImportStatus(message: string | undefined, code: string | undefined): { status: number; error: string } {
  if (code === '28000' || message === 'Invalid or revoked finance token') return { status: 401, error: 'Invalid or revoked finance token' };
  if (code === '53300' || message === 'Too many finance imports') return { status: 429, error: 'Too many finance imports' };
  if (code === '54000' || message === 'Too many transactions') return { status: 400, error: 'Too many transactions' };
  if (code === '42501' || message === 'Finance import is owner-only') return { status: 403, error: 'Finance import is owner-only' };
  const status = message ? SAFE_ERRORS.get(message) : undefined;
  if (status) return { status, error: message ?? 'Invalid finance import' };
  return { status: 500, error: 'Could not import transactions' };
}

export async function handleMonarchImport(request: Request, deps: ImportDeps): Promise<Response> {
  if (request.method !== 'POST') {
    return json({ error: 'Use POST' }, 405, { Allow: 'POST' });
  }
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(declared) && declared > FINANCE_IMPORT_LIMITS.maxBytes) {
    return json({ error: 'Too many transactions' }, 400);
  }
  const token = readBearer(request.headers.get('authorization'));
  if (!token || !FINANCE_TOKEN_PATTERN.test(token)) {
    return json({ error: 'Invalid or revoked finance token' }, 401);
  }
  let text: string;
  try {
    text = await request.text();
  } catch {
    return json({ error: 'Invalid finance import' }, 400);
  }
  if (text.length > FINANCE_IMPORT_LIMITS.maxBytes) return json({ error: 'Too many transactions' }, 400);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return json({ error: 'Invalid finance import' }, 400);
  }
  const body = parseMonarchImport(parsed);
  if (!body.ok) return json({ error: body.error }, body.error === 'Too many transactions' ? 400 : 400);
  const saved = await deps.importRows(hashFinanceToken(token), body.value);
  if (!saved.ok) return json({ error: saved.error }, saved.status);
  return json(saved.result, 200);
}

function readBearer(header: string | null): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match ? match[1] : null;
}

function json(body: unknown, status: number, extra: Record<string, string> = {}): Response {
  const headers: Record<string, string> = { 'Cache-Control': 'no-store', ...extra };
  if (status === 401) headers['WWW-Authenticate'] = REALM;
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}
