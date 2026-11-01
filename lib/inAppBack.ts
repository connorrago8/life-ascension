/**
 * In-app "← Back" links. If the previous history entry is already the
 * target, go back so the browser Back button does not bounce forward
 * again. Otherwise replace the current entry, which also avoids a loop.
 */

const STACK_KEY = 'life-ascension:path-stack';

export function pathKey(href: string): string {
  const url = new URL(href, 'http://local');
  const path = url.pathname.replace(/\/$/, '') || '/';
  return url.search ? `${path}${url.search}` : path;
}

export function noteVisit(stack: readonly string[], pathname: string): string[] {
  const next = pathKey(pathname);
  if (stack[stack.length - 1] === next) return [...stack];
  return [...stack, next];
}

export function notePop(stack: readonly string[]): string[] {
  return stack.slice(0, -1);
}

export function backDecision(stack: readonly string[], target: string): { action: 'back' | 'replace'; stack: string[] } {
  const dest = pathKey(target);
  const previous = stack.length >= 2 ? stack[stack.length - 2] : null;
  if (previous === dest) return { action: 'back', stack: [...stack] };
  const next = stack.length === 0 ? [dest] : [...stack.slice(0, -1), dest];
  return { action: 'replace', stack: next };
}

export function readPathStack(): string[] {
  if (typeof sessionStorage === 'undefined') return [];
  try {
    const parsed = JSON.parse(sessionStorage.getItem(STACK_KEY) || '[]') as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export function writePathStack(stack: readonly string[]): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(STACK_KEY, JSON.stringify(stack.slice(-30)));
  } catch {
    /* Storage can be blocked. Replace still avoids a new history entry. */
  }
}

export function performInAppBack(router: { replace: (href: string) => void }, href: string): 'back' | 'replace' {
  const decision = backDecision(readPathStack(), href);
  if (decision.action === 'back') {
    window.history.back();
    return 'back';
  }
  writePathStack(decision.stack);
  router.replace(href);
  return 'replace';
}
