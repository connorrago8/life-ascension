import { isQuestDomain } from './domains';
import type { QuestTemplate } from './questTemplates';

/**
 * Day 1 onboarding eligibility (design Q21). No schema change.
 *
 * Show the flow only when BOTH are true:
 * - auth user_metadata has no non-empty `onboarded_at`
 * - the signed-in user has zero quest rows ever
 *
 * The quest count includes archived rows (`active = false`). Archive keeps the
 * row, so a player who archived every quest is not new. There is no client
 * delete path. If a quest is hard-deleted outside the app, the row is gone and
 * the count cannot see it. `onboarded_at` is the backstop for that case.
 * It is written when the player finishes, skips setup, chooses "Create my own
 * quest", or successfully accepts a suggestion. Closing the app without one of
 * those actions does not write the stamp, so a player who accepted nothing
 * still sees the flow. A player who accepted one quest and left is hidden by
 * the quest count even if the stamp has not landed yet.
 *
 * A failed count is not treated as zero. Returning players stay on the board
 * when we cannot prove they are new.
 *
 * Duplicate accepts: the button, an in-memory claim, a same-browser
 * localStorage claim, and a title lookup (including archived rows) stop a
 * second create once the first row is visible. `create_scheduled_quest` always
 * inserts a new id. The table's only uniqueness on quests is (id, owner_id).
 * Two overlapping creates that both pass the lookup before either insert
 * commits can still store two quests with the same title. There is no
 * idempotency key on the RPC.
 */

export type OnboardingSignals = {
  onboardedAt: unknown;
  questCountEver: number;
};

export function hasOnboardedStamp(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

/** True only for a player with no stamp and a proven count of zero quests. */
export function shouldShowOnboarding(signals: OnboardingSignals): boolean {
  if (hasOnboardedStamp(signals.onboardedAt)) return false;
  return signals.questCountEver === 0;
}

export type PreviewStep = 'welcome' | 'focus' | 'quests' | 'board';

/** Dev-only screenshot hook. Production builds ignore `?preview=1`. */
export function isOnboardingPreview(search: string, nodeEnv: string | undefined): boolean {
  if (nodeEnv === 'production') return false;
  return readParam(search, 'preview') === '1';
}

export function readPreviewStep(search: string): PreviewStep {
  const step = readParam(search, 'step');
  if (step === 'focus' || step === 'quests' || step === 'board') return step;
  return 'welcome';
}

function readParam(search: string, name: string): string | null {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  return params.get(name);
}

export type OnboardingClient = {
  from(table: string): {
    select(columns: string, options?: { count?: 'exact'; head?: boolean }): OnboardingFilter;
  };
  rpc(fn: string, args: Record<string, unknown>): Promise<{ data: unknown; error: { message: string } | null }>;
  auth: {
    updateUser(input: { data: { onboarded_at: string } }): Promise<{ error: { message: string } | null }>;
  };
};

export type OnboardingFilter = {
  eq(column: string, value: string): OnboardingFilter;
  then<TResult1 = QuestRead, TResult2 = never>(
    onfulfilled?: ((value: QuestRead) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2>;
};

type QuestRead = {
  data: { id?: string; title?: string; active?: boolean }[] | null;
  error: { message: string } | null;
  count?: number | null;
};

/** Owner-scoped count of every quest row, including archived. Does not filter `active`. */
export async function countQuestsEver(client: OnboardingClient, userId: string): Promise<number> {
  const { count, error } = await client.from('quests').select('id', { count: 'exact', head: true }).eq('owner_id', userId);
  if (error) throw new Error(error.message);
  return typeof count === 'number' ? count : Number.NaN;
}

export async function markOnboarded(
  client: OnboardingClient,
  now: Date = new Date(),
): Promise<{ error: string | null; onboardedAt: string }> {
  const onboardedAt = now.toISOString();
  const { error } = await client.auth.updateUser({ data: { onboarded_at: onboardedAt } });
  return { error: error?.message ?? null, onboardedAt };
}

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export function acceptClaimKey(userId: string, templateId: string): string {
  return `life-ascension:onboarding-accept:${userId}:${templateId}`;
}

export function browserClaimStorage(): StorageLike | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

export type AcceptResult =
  | { status: 'created'; id: string }
  | { status: 'duplicate' }
  | { status: 'invalid'; message: string }
  | { status: 'error'; message: string };

export function validateSuggestedQuest(template: QuestTemplate, today: string): string | null {
  const title = template.title.trim();
  if (title.length < 1 || title.length > 120) return 'Invalid title';
  if (!isQuestDomain(template.focus)) return 'Invalid domain';
  if (template.cadence !== 'once' && template.cadence !== 'daily') return 'Invalid cadence';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) return 'Invalid date';
  return null;
}

/**
 * Create one suggested quest through create_scheduled_quest.
 * Does not complete the quest and does not award XP.
 */
export async function acceptSuggestedQuest(
  client: OnboardingClient,
  input: {
    userId: string;
    template: QuestTemplate;
    today: string;
    claimed: Set<string>;
    storage: StorageLike | null;
  },
): Promise<AcceptResult> {
  const invalid = validateSuggestedQuest(input.template, input.today);
  if (invalid) return { status: 'invalid', message: invalid };
  if (!input.userId) return { status: 'error', message: 'Sign-in required' };

  const templateId = input.template.id;
  if (input.claimed.has(templateId)) return { status: 'duplicate' };

  const key = acceptClaimKey(input.userId, templateId);
  if (input.storage?.getItem(key)) return { status: 'duplicate' };
  input.storage?.setItem(key, 'pending');
  input.claimed.add(templateId);

  try {
    const title = input.template.title.trim();
    const existing = await client
      .from('quests')
      .select('id,title,active')
      .eq('owner_id', input.userId)
      .eq('title', title);
    if (existing.error) throw new Error(existing.error.message);
    if ((existing.data ?? []).length > 0) {
      input.storage?.setItem(key, 'saved');
      return { status: 'duplicate' };
    }

    const created = await client.rpc('create_scheduled_quest', {
      p_title: title,
      p_domain: input.template.focus,
      p_cadence: input.template.cadence,
      p_date: input.today,
      p_quest_type: 'scheduled',
    });
    if (created.error || typeof created.data !== 'string') {
      input.claimed.delete(templateId);
      input.storage?.removeItem(key);
      return { status: 'error', message: created.error?.message || 'Quest was not created' };
    }

    input.storage?.setItem(key, 'saved');
    await markOnboarded(client);
    return { status: 'created', id: created.data };
  } catch (error) {
    input.claimed.delete(templateId);
    input.storage?.removeItem(key);
    return { status: 'error', message: error instanceof Error ? error.message : 'Quest was not created' };
  }
}
