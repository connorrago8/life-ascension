import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

async function loadPolicy() {
  const source = await readFile(new URL('../lib/questDailyDatePolicy.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true,
  });
  assert.equal((compiled.diagnostics ?? []).filter(x => x.category === ts.DiagnosticCategory.Error).length, 0);
  return import('data:text/javascript;charset=utf-8,' + encodeURIComponent(compiled.outputText));
}

test('A12: same UTC instant belongs to different player-local days', async () => {
  const { dateInTimeZone, evaluateDailyDatePolicy } = await loadPolicy();
  const now = '2026-10-27T04:30:00Z';
  assert.equal(dateInTimeZone(now, 'America/Chicago'), '2026-10-26');
  assert.equal(dateInTimeZone(now, 'America/New_York'), '2026-10-27');
  assert.equal(dateInTimeZone(now, 'Asia/Tokyo'), '2026-10-27');
  const fixture = { now, dueDate: '2026-10-27', scheduledFor: '2026-10-25', createdAt: '2026-10-25T12:00:00Z' };
  assert.equal(evaluateDailyDatePolicy({ ...fixture, timeZone: 'America/Chicago' }), 'future');
  assert.equal(evaluateDailyDatePolicy({ ...fixture, timeZone: 'America/New_York' }), 'eligible');
});

test('A12: DST midnight transition uses actual IANA zone, not a fixed UTC offset', async () => {
  const { dateInTimeZone } = await loadPolicy();
  assert.equal(dateInTimeZone('2026-11-01T04:30:00Z', 'America/Chicago'), '2026-10-31');
  assert.equal(dateInTimeZone('2026-11-01T05:30:00Z', 'America/Chicago'), '2026-11-01');
});

test('A12: two-day compatibility window remains eligible; third day is rejected', async () => {
  const { evaluateDailyDatePolicy } = await loadPolicy();
  const base = {
    now: '2026-10-27T18:00:00Z', timeZone: 'America/Chicago',
    scheduledFor: '2026-10-20', createdAt: '2026-10-20T15:00:00Z',
  };
  assert.equal(evaluateDailyDatePolicy({ ...base, dueDate: '2026-10-25' }), 'eligible');
  assert.equal(evaluateDailyDatePolicy({ ...base, dueDate: '2026-10-24' }), 'outside_two_day_window');
  assert.equal(evaluateDailyDatePolicy({ ...base, dueDate: '2026-10-28' }), 'future');
  assert.equal(evaluateDailyDatePolicy({ ...base, dueDate: '2026-10-19' }), 'before_schedule');
});

test('A12: creation-date guard is opt-in, not a silent change to existing backdating', async () => {
  const { evaluateDailyDatePolicy } = await loadPolicy();
  const base = {
    now: '2026-10-27T18:00:00Z', timeZone: 'America/Chicago',
    dueDate: '2026-10-26', scheduledFor: '2026-10-25',
    createdAt: '2026-10-27T15:00:00Z',
  };
  assert.equal(evaluateDailyDatePolicy(base), 'eligible');
  assert.equal(evaluateDailyDatePolicy({ ...base, policy: 'legacy_two_day' }), 'eligible');
  assert.equal(evaluateDailyDatePolicy({ ...base, policy: 'creation_date_guard' }), 'before_creation');
  assert.equal(evaluateDailyDatePolicy({
    ...base, createdAt: '2026-10-25T15:00:00Z', policy: 'creation_date_guard',
  }), 'eligible');
});

test('A12: invalid dates, timestamps and IANA zones fail closed', async () => {
  const { dateInTimeZone, evaluateDailyDatePolicy } = await loadPolicy();
  assert.throws(() => dateInTimeZone('bad', 'America/Chicago'), RangeError);
  assert.throws(() => dateInTimeZone('2026-10-27T00:00:00Z', 'Not/AZone'), RangeError);
  assert.throws(() => evaluateDailyDatePolicy({
    now: '2026-10-27T18:00:00Z', timeZone: 'America/Chicago',
    dueDate: '2026-02-30', scheduledFor: '2026-02-01', createdAt: '2026-02-01T15:00:00Z',
  }), RangeError);
});
