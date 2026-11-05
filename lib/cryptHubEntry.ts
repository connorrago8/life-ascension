import { loadActiveRun } from './cryptActiveRun.ts';

type RunStorage = Parameters<typeof loadActiveRun>[0];

/**
 * Hub has no authenticated identity read. Only the dev-preview branch and an
 * unconfigured guest client have an owner it can establish without guessing.
 * A configured account client uses neutral entry wording; Crypt resolves its
 * identity and continuation normally. Never infer identity from stored records.
 */
export function hubCryptContinuation(
  storage: RunStorage | null,
  search: string,
  development: boolean,
  backendConfigured: boolean,
  now: number,
): boolean {
  const preview = development && new URLSearchParams(search).get('preview') === '1';
  const owner = preview ? 'preview' : backendConfigured ? null : 'guest';
  return !!(owner && storage && loadActiveRun(storage, owner, now));
}
