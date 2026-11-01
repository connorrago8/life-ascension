import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// SHA-256 of the exact SELECT-only pg_get_functiondef snapshot in
// tests/fixtures/qa-log-progress-baseline.sql (QA project only).
export const QA_PROJECT_REF = 'njqwwimzrsunheehnnnt';
export const QA_BASELINE_FUNCTION_SHA256 = 'da7389aef625bb3ac1774f58d256938fbcea95558b2a104ce699d2e60e1f6075';
const TABLES = ['quests', 'quest_instances', 'quest_progress_operations'];

export function verifyQaAtomicClearPreflight(projectRef, snapshot) {
  const blockers = [];
  if (projectRef !== QA_PROJECT_REF) blockers.push('not the approved QA project');
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return { ok: false, blockers: [...blockers, 'missing or invalid catalog snapshot'] };
  }
  if (snapshot.function_sha256 !== QA_BASELINE_FUNCTION_SHA256) {
    blockers.push('hosted function differs from the reviewed baseline');
  }
  if (snapshot.atomic_clear_present !== false) {
    blockers.push('Clear guard is already present or its state is unknown');
  }
  if (snapshot.authenticated_exec !== true || snapshot.anon_exec !== false) {
    blockers.push('RPC execute grants differ from the approved contract');
  }
  if (!Array.isArray(snapshot.tables)) {
    blockers.push('table/RLS catalog evidence missing');
  } else {
    for (const name of TABLES) {
      const matches = snapshot.tables.filter(t => t?.table_name === name);
      if (matches.length !== 1 || matches[0].rls_enabled !== true) {
        blockers.push(name + ': missing table or RLS disabled');
        continue;
      }
      const policies = matches[0].policies;
      if (!Array.isArray(policies)) {
        blockers.push(name + ': policy catalog missing');
        continue;
      }
      const readPolicies = policies.filter(p => p?.cmd === 'SELECT' || p?.cmd === 'ALL');
      const authReadPolicies = readPolicies.filter(p => Array.isArray(p.roles) &&
        p.roles.some(role => role === 'authenticated' || role === 'public'));
      if (authReadPolicies.length === 0 || authReadPolicies.length !== readPolicies.length) {
        blockers.push(name + ': unexpected SELECT policy roles or missing authenticated owner policy');
        continue;
      }
      // Fail closed if any permissive SELECT/ALL policy could admit other owners.
      if (authReadPolicies.some(p => !/^\(owner_id = \( SELECT auth\.uid\(\) AS uid\)\)$/.test(p.qual))) {
        blockers.push(name + ': SELECT policy is not the reviewed owner filter');
      }
    }
  }
  return { ok: blockers.length === 0, blockers };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const snapshot = JSON.parse(readFileSync(0, 'utf8'));
    const result = verifyQaAtomicClearPreflight(process.argv[2], snapshot);
    if (result.ok) {
      process.stdout.write('PASS: reviewed QA Clear Progress preflight matches; NOT migration authorization.\n');
    } else {
      process.stderr.write('BLOCKED: ' + result.blockers.join('; ') + '\n');
      process.exitCode = 1;
    }
  } catch {
    // Do not echo untrusted input, which might contain credentials.
    process.stderr.write('BLOCKED: unreadable catalog JSON\n');
    process.exitCode = 1;
  }
}
