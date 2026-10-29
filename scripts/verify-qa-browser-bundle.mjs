// Inspect emitted browser JavaScript only. This is a source-build check,
// NOT proof of hosted Preview routing or permission to deploy/migrate.
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

const QA_PROJECT = 'njqwwimzrsunheehnnnt';
const PRODUCTION_PROJECT = 'ugcvhmrriazbbymjxvch';
const SUPABASE_HOST = /\b([a-z0-9]{20})\.supabase\.co\b/gi;

export async function inspectQaBrowserBundle(root, { qaProject = QA_PROJECT } = {}) {
  const digest = createHash('sha256');
  let inspected = 0;
  let qaMatches = 0;
  let foreignHosts = 0;
  let privilegedMarkers = 0;
  let productionReferences = 0;

  async function scan(dir) {
    // Sort for deterministic fingerprints independent of directory traversal.
    const entries = (await readdir(dir, { withFileTypes: true }))
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) { await scan(path); continue; }
      if (!entry.isFile() || !/\.(?:js|mjs)$/.test(entry.name)) continue;
      const source = await readFile(path, 'utf8');
      inspected++;
      const hosts = [...source.matchAll(SUPABASE_HOST)];
      if (hosts.some(match => match[1].toLowerCase() === qaProject)) {
        qaMatches++;
        digest.update(relative(root, path)).update('\0').update(source).update('\0');
      }
      foreignHosts += hosts.filter(match => match[1].toLowerCase() !== qaProject).length;
      if (source.includes(PRODUCTION_PROJECT)) productionReferences++;
      if (/sb_secret_[a-z0-9_-]+|SUPABASE_SERVICE_ROLE_KEY/i.test(source)) privilegedMarkers++;
    }
  }
  await scan(root);
  if (!inspected) throw new Error('QA browser bundle contains no emitted JavaScript files');
  // Do not print matched URLs, tokens or file contents in CI logs.
  if (foreignHosts || productionReferences || privilegedMarkers) {
    throw new Error('QA browser bundle contains a foreign Supabase target or privileged marker');
  }
  if (!qaMatches) throw new Error('QA browser bundle contains no expected QA Supabase hostname');
  return {
    inspected, qaMatches, foreignHosts, productionReferences, privilegedMarkers,
    sourceFingerprint: digest.digest('hex').slice(0, 16),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await inspectQaBrowserBundle('.next/static');
    console.log('QA browser bundle source check PASS:', result);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
