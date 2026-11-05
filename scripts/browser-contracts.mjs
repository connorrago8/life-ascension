/** Explicit required coverage. No globs, optional suites, or user-provided commands in CI. */
export const BROWSER_CONTRACTS = Object.freeze({
  'browser-smoke': Object.freeze([
    ['checkpoint', 'brain-rot-checkpoint', true],
    ['navigation', 'brain-rot-navigation'], ['jetpack-controls', 'jetpack-controls'],
    ['lantern-persistence', 'lantern-persistence'], ['local-progress', 'local-progress-integration'],
    ['hub-destinations', 'hub-destinations'], ['town-destinations', 'town-destinations'],
    ['crypt-continuation', 'crypt-continuation'], ['lantern-guided-route', 'lantern-guided-route'],
    ['crypt-combat-resources', 'crypt-combat-resources'],
    ['crypt-deck-inspection', 'crypt-deck-inspection'],
    ['town-mode-continuity', 'town-mode-continuity'],
    ['checkpoint-races', 'brain-rot-checkpoint-races', true],
  ].map(([name, file, test]) => Object.freeze({ name, file: `tests/browser/${file}.qa.mjs`, test: !!test }))),
  'boss-boundary': Object.freeze([
    ['boss-boundaries', 'brain-rot-boss-boundaries'],
    ['boss-handoff', 'brain-rot-boss-handoff'],
    ['boss-recovery', 'brain-rot-boss-recovery'],
  ].map(([name, file]) => Object.freeze({ name, file: `tests/browser/${file}.qa.mjs`, test: true }))),
});

/** All expected suites must have actually exited cleanly at this checkout. */
export function contractReceiptIssues(group, sha, rows) {
  const expected = BROWSER_CONTRACTS[group];
  if (!expected) return [`Unknown browser group: ${group}`];
  if (!Array.isArray(rows)) return [`Missing contract receipts: ${group}`];
  const issues = [], seen = new Set();
  for (const row of rows) {
    const spec = expected.find(spec => spec.name === row?.name);
    if (!spec) { issues.push(`Unexpected contract: ${group}/${row?.name}`); continue; }
    const label = `${group}/${row.name}`;
    if (seen.has(row.name)) issues.push(`Duplicate contract: ${label}`);
    seen.add(row.name);
    if (row.sha !== sha) issues.push(`Contract SHA mismatch: ${label}`);
    if (row.file !== spec.file) issues.push(`Contract file mismatch: ${label}`);
    if (row.result !== 'success' || row.exitCode !== 0 || row.signal !== null || row.error !== null) {
      issues.push(`Contract failed or incomplete: ${label} (exit=${row.exitCode}, signal=${row.signal}, error=${row.error})`);
    }
  }
  for (const spec of expected) if (!seen.has(spec.name)) issues.push(`Missing contract: ${group}/${spec.name}`);
  return issues;
}
