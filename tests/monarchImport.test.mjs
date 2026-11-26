import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { financeImportVisible } from '../lib/ascension/financeAccess.ts';
import {
  csvRowHash,
  dedupeCsvRows,
  maskAccountLabel,
  parseAmount,
  parseMonarchCsv,
} from '../lib/ascension/monarchCsv.ts';
import { isPostedPayment, noSpendState, paymentPostedState, weekSpendingState, xpOnce } from '../lib/ascension/moneyQuests.ts';
import {
  FINANCE_IMPORT_LIMITS,
  FINANCE_IMPORT_PATH,
  FINANCE_IMPORT_SOURCE,
  financeImportStatus,
  handleMonarchImport,
  hashFinanceToken,
  parseMonarchImport,
} from '../lib/finance/monarchImport.ts';

const CSV = [
  'Tags,Merchant,Date,Amount,Notes,Category,Account,Original Statement,Extra',
  '"food","Market, North","11/01/2026","-$1,234.50","said ""hi""","Groceries","Visa 1234567812345678","MARKET NORTH",""',
  'move,Transfer Co,2026-11-02,(40.00),,Transfer,Checking 9999,TRANSFER,',
].join('\n');

test('monarch csv keeps quoted commas and negative amounts', () => {
  const parsed = parseMonarchCsv(CSV);
  assert.equal(parsed.rowCount, 2);
  assert.equal(parsed.dateStart, '2026-11-01');
  assert.equal(parsed.dateEnd, '2026-11-02');
  assert.equal(parsed.rows[0].merchant, 'Market, North');
  assert.equal(parsed.rows[0].amount, -1234.5);
  assert.equal(maskAccountLabel(parsed.rows[0].accountLabel), 'Visa ••••5678');
  assert.equal(parsed.rows[1].amount, -40);
  assert.equal(parseAmount('-$12.00'), -12);
  assert.equal(parseAmount('(8.25)'), -8.25);
});

test('overlapping csv rows dedupe on the content hash', () => {
  const first = parseMonarchCsv(CSV).rows;
  const again = parseMonarchCsv(`${CSV}\nmove,Transfer Co,2026-11-02,(40.00),,Transfer,Checking 9999,TRANSFER,`).rows;
  assert.equal(csvRowHash(first[1]), csvRowHash(again[2]));
  assert.equal(dedupeCsvRows([...first, ...again]).length, 2);
  assert.notEqual(csvRowHash(first[0]), csvRowHash(first[1]));
});

test('payment posted matches a payment or a negative transfer and ignores a miss', () => {
  const week = ['2026-11-23', '2026-11-25'];
  const miss = [{ date: '2026-11-25', category: 'Groceries', amount: -10 }];
  const payment = [{ date: '2026-11-25', category: 'Credit Card Payment', amount: -40, pending: false }];
  const pending = [{ date: '2026-11-25', category: 'Credit Card Payment', amount: -40, pending: true }];
  const transfer = [{ date: '2026-11-24', category: 'Transfer', amount: -15 }];
  assert.equal(paymentPostedState(miss, ...week), 'needs_review');
  assert.equal(paymentPostedState(pending, ...week), 'needs_review');
  assert.equal(paymentPostedState(payment, ...week), 'matched');
  assert.equal(isPostedPayment(transfer[0]), true);
  assert.equal(paymentPostedState([], ...week), 'unchanged');
  assert.equal(noSpendState([{ date: '2026-11-25', category: 'Paycheck', amount: 100 }], '2026-11-25'), 'matched');
  assert.equal(noSpendState(miss, '2026-11-25'), 'needs_review');
  assert.equal(weekSpendingState(miss, ...week, false), 'waiting');
  assert.equal(weekSpendingState(miss, ...week, true), 'matched');
});

test('a money quest pays XP once', () => {
  assert.deepEqual(xpOnce(false, true), { pay: true, xp: 10 });
  assert.deepEqual(xpOnce(true, true), { pay: false, xp: 0 });
  assert.deepEqual(xpOnce(false, false), { pay: false, xp: 0 });
});

test('monarch import rejects a bad token and accepts the documented JSON shape', async () => {
  assert.equal(FINANCE_IMPORT_PATH, '/api/finance/transactions/import');
  const token = `la_fin_${'a'.repeat(64)}`;
  const body = {
    request_id: '00000000-0000-4000-8000-00000000d701',
    source: FINANCE_IMPORT_SOURCE,
    transactions: [{
      id: 'txn_synthetic_1',
      date: '2026-11-25',
      merchant: 'Card Pay',
      category: 'Credit Card Payment',
      account_label: 'Checking',
      amount: -40,
      pending: true,
    }],
  };
  assert.equal(parseMonarchImport(body).ok, true);
  let calls = 0;
  const bad = await handleMonarchImport(new Request('http://local.test/api/finance/transactions/import', {
    method: 'POST',
    headers: { authorization: 'Bearer nope', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }), { importRows: async () => { calls += 1; return { ok: false, status: 500, error: 'no' }; } });
  assert.equal(bad.status, 401);
  assert.equal(calls, 0);
  const seen = [];
  const ok = await handleMonarchImport(new Request('http://local.test/api/finance/transactions/import', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }), {
    importRows: async (tokenHash, parsed) => {
      seen.push({ tokenHash, id: parsed.transactions[0].id, pending: parsed.transactions[0].pending });
      return {
        ok: true,
        result: {
          ok: true, replayed: false, request_id: parsed.request_id,
          inserted: 1, updated: 0, unchanged: 0,
          verification: { payment_posted: { status: 'needs_review', xp_awarded: 0 } },
        },
      };
    },
  });
  assert.equal(ok.status, 200);
  assert.equal(seen[0].tokenHash, hashFinanceToken(token));
  assert.equal(seen[0].pending, true);
  const posted = { ...body, request_id: '00000000-0000-4000-8000-00000000d702', transactions: [{ ...body.transactions[0], pending: false }] };
  const second = await handleMonarchImport(new Request('http://local.test/api/finance/transactions/import', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(posted),
  }), {
    importRows: async (_hash, parsed) => ({
      ok: true,
      result: {
        ok: true, replayed: false, request_id: parsed.request_id,
        inserted: 0, updated: 1, unchanged: 0,
        verification: { payment_posted: { status: 'matched', xp_awarded: 10, already: false } },
      },
    }),
  });
  const payload = await second.json();
  assert.equal(payload.updated, 1);
  assert.equal(payload.verification.payment_posted.xp_awarded, 10);
  const replay = await handleMonarchImport(new Request('http://local.test/api/finance/transactions/import', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(posted),
  }), {
    importRows: async (_hash, parsed) => ({
      ok: true,
      result: {
        ok: true, replayed: true, request_id: parsed.request_id,
        inserted: 0, updated: 1, unchanged: 0,
        verification: { payment_posted: { status: 'matched', xp_awarded: 0, already: true } },
      },
    }),
  });
  const again = await replay.json();
  assert.equal(again.replayed, true);
  assert.equal(again.verification.payment_posted.xp_awarded, 0);
  assert.equal(financeImportStatus('Too many finance imports', '53300').status, 429);
  assert.equal(financeImportStatus('Invalid or revoked finance token', '28000').status, 401);
  const huge = await handleMonarchImport(new Request('http://local.test/api/finance/transactions/import', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-length': String(FINANCE_IMPORT_LIMITS.maxBytes + 1) },
    body: '{}',
  }), { importRows: async () => { throw new Error('should not run'); } });
  assert.equal(huge.status, 400);
});

test('the import screen stays off the companion session', () => {
  const source = readFileSync(new URL('../components/ascension/FinanceImport.tsx', import.meta.url), 'utf8');
  assert.equal(financeImportVisible('companion'), false);
  assert.equal(financeImportVisible('signed-out'), false);
  assert.equal(financeImportVisible('adventurer'), true);
  assert.match(source, /if \(!ready \|\| !financeImportVisible\(mode\)\) return null/);
  assert.match(source, /data-review="needs-review"/);
  assert.match(source, /Monarch CSV/);
  assert.doesNotMatch(source, /finance_transactions|monarch_mcp/);
});
