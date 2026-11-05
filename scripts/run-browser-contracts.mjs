import { spawnSync, execFileSync } from 'node:child_process';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { BROWSER_CONTRACTS, contractReceiptIssues } from './browser-contracts.mjs';

/** Continue after a failed/crashed/timed-out child, but never turn it green. */
export function runContracts(specs, sha, { execute = args => spawnSync(process.execPath, args, {
  stdio: 'inherit', timeout: 180_000, killSignal: 'SIGKILL',
}), onProgress = () => {} } = {}) {
  if (!/^[a-f0-9]{40}$/.test(sha)) throw Error('Full actual checkout SHA is required');
  const rows = [];
  onProgress(rows); // Clear any stale report before starting this invocation.
  for (const spec of specs) {
    const start = Date.now();
    let child;
    try { child = execute([...(spec.test ? ['--test'] : []), spec.file]); }
    catch (error) { child = { error }; }
    const exitCode = Number.isInteger(child?.status) ? child.status : null;
    const signal = child?.signal ?? null;
    const error = child?.error ? String(child.error.code || child.error.message || child.error) : null;
    const result = exitCode === 0 && signal === null && error === null ? 'success' : 'failure';
    rows.push({ name: spec.name, file: spec.file, sha, result, exitCode, signal, error, durationMs: Date.now() - start });
    onProgress([...rows]);
  }
  return rows;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const group = process.argv[2];
    const specs = BROWSER_CONTRACTS[group];
    if (!specs) throw Error('Known browser contract group is required');
    const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    mkdirSync('browser-contract-evidence', { recursive: true });
    const rows = runContracts(specs, sha, { onProgress: contracts => {
      writeFileSync(`browser-contract-evidence/${group}.json`, JSON.stringify({ group, sha, contracts }, null, 2));
      const last = contracts.at(-1);
      if (last) console.log('CONTRACT_RESULT ' + JSON.stringify(last));
    } });
    const issues = contractReceiptIssues(group, sha, rows);
    const summary = [`## ${group} — ${sha}`, '', '| Contract | Result | Exit / signal |', '|---|---|---|',
      ...rows.map(row => `| ${row.name} | ${row.result} | ${row.exitCode ?? 'none'} / ${row.signal ?? 'none'} |`),
      '', 'Sandboxed localhost Chromium only; no release authorization.', ''].join('\n');
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
    console.log(summary);
    if (issues.length) { console.error(issues.join('\n')); process.exitCode = 1; }
  } catch (error) {
    console.error('Browser contracts incomplete: ' + error.message);
    process.exitCode = 1;
  }
}
