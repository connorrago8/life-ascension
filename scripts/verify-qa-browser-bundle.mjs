// Inspect emitted browser JavaScript and public JavaScript source maps. This is a source-build check,
// NOT proof of hosted Preview routing or permission to deploy/migrate.
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

const QA_PROJECT = 'njqwwimzrsunheehnnnt';
const PRODUCTION_PROJECT = 'ugcvhmrriazbbymjxvch';
// Require exact DNS-label boundaries for QA hostname evidence.
const SUPABASE_HOST = /(?<![a-z0-9_.-])([a-z0-9]{20})\.supabase\.co(?![a-z0-9_.-])/gi;
// Scan complete JWTs without logging their contents. An embedded service_role
// token is privileged even if it has no recognizable variable name.
const JWT = /\beyJ[A-Za-z0-9_-]{5,}\.(eyJ[A-Za-z0-9_-]{5,})\.[A-Za-z0-9_-]{8,}\b/g;

function hasForbiddenJwt(source) {
  for (const match of source.matchAll(JWT)) {
    try {
      const claims = JSON.parse(Buffer.from(match[1], 'base64url').toString('utf8'));
      if (claims?.role === 'service_role' ||
          (typeof claims?.ref === 'string' && claims.ref.toLowerCase() === PRODUCTION_PROJECT)) {
        return true;
      }
    } catch { /* Not a parseable JWT payload; existing markers still apply. */ }
  }
  return false;
}

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
      if (!entry.isFile()) continue;
      const isJavaScript = /\.(?:js|mjs)$/.test(entry.name);
      const isPublicSourceMap = /\.(?:js|mjs)\.map$/.test(entry.name);
      if (!isJavaScript && !isPublicSourceMap) continue;
      const source = await readFile(path, 'utf8');
      if (isJavaScript) inspected++;
      // Fingerprint every public JS asset and matching source map.
      // A changed unrelated chunk must invalidate deployment provenance.
      digest.update(relative(root, path)).update('\0').update(source).update('\0');
      const hosts = [...source.matchAll(SUPABASE_HOST)];
      if (isJavaScript && hosts.some(match => match[1].toLowerCase() === qaProject)) {
        qaMatches++;
      }
      foreignHosts += hosts.filter(match => match[1].toLowerCase() !== qaProject).length;
      if (source.toLowerCase().includes(PRODUCTION_PROJECT)) productionReferences++;
      if (/sb_secret_[a-z0-9_-]+|SUPABASE_SERVICE_ROLE_KEY/i.test(source) || hasForbiddenJwt(source)) privilegedMarkers++;
    }
  }
  await scan(root);
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
