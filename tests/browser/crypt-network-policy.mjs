/**
 * Allow only local, read-only assets and the Crypt preview document.
 * The preview promises no account activity; off-origin requests and backend
 * endpoints are never silently exempted. Pure helper for browser QA.
 * @param {{url: string, method: string}} request
 * @param {string} baseURL
 * @returns {string|null} null means allowed; otherwise a safe reason.
 */
export function cryptPreviewRequestViolation(request, baseURL) {
  if (!request || typeof request.url !== 'string' || typeof request.method !== 'string') {
    return 'invalid request metadata';
  }
  let target;
  let base;
  try {
    target = new URL(request.url);
    base = new URL(baseURL);
  } catch {
    return 'invalid request URL';
  }
  if (!['http:', 'https:'].includes(target.protocol) || target.origin !== base.origin) {
    return 'off-origin or non-HTTP request';
  }
  if (request.method.toUpperCase() !== 'GET') {
    return 'non-GET request';
  }
  let path;
  try {
    path = decodeURIComponent(target.pathname);
  } catch {
    return 'invalid encoded path';
  }
  // A decoded static-prefix lookalike must never authorize traversals or separator aliases.
  if (path.includes('\\') || path.includes('//') ||
      path.split('/').some(part => part === '.' || part === '..')) {
    return 'invalid path segments';
  }
  if (path === '/play/crypt' || path === '/play/crypt/' ||
      path.startsWith('/_next/static/') || path === '/_next/image' ||
      path === '/favicon.ico' || path === '/robots.txt' ||
      path === '/manifest.webmanifest' ||
      /^\/(?:assets|images|fonts)\/[a-zA-Z0-9_./-]+\.(?:png|jpe?g|webp|gif|svg|ico|woff2?|ttf|css|js)$/.test(path)) {
    return null;
  }
  return 'unexpected local route';
}
