/**
 * Web Push bodies. `renotify` is always false so a repeated tag replaces the
 * existing notification instead of stacking. Daily progress always uses the
 * tag `daily-progress`. Partner copy never includes the other account's XP,
 * level, or streak — only the assigned quest's title.
 */

export type PushPayload = {
  title: string;
  body: string;
  tag: string;
  renotify: false;
  url: string;
};

export type OwnProgress = {
  completed: number;
  total: number;
  streak: number;
  xpIntoLevel: number;
  xpForNext: number;
  url?: string;
};

const TAGS = {
  partner_assigned: 'partner-assigned',
  partner_completed: 'partner-completed',
  streak_at_risk: 'streak-at-risk',
  daily_progress: 'daily-progress',
} as const;

export function safeNotificationPath(value: unknown): string {
  if (typeof value !== 'string') return '/quests';
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\') || value.includes('://')) return '/quests';
  if (value.includes('?') || value.includes('#') || value.includes('\n')) return '/quests';
  return value;
}

export function notificationPayload(input: {
  kind: keyof typeof TAGS;
  title: string;
  body: string;
  url?: string;
}): PushPayload {
  return {
    title: input.title.slice(0, 80),
    body: input.body.slice(0, 180),
    tag: TAGS[input.kind],
    renotify: false,
    url: safeNotificationPath(input.url),
  };
}

export function dailyProgressPayload(state: OwnProgress): PushPayload {
  const completed = Math.max(0, Math.floor(state.completed));
  const total = Math.max(completed, Math.floor(state.total));
  const streak = Math.max(0, Math.floor(state.streak));
  const into = Math.max(0, Math.floor(state.xpIntoLevel));
  const next = Math.max(1, Math.floor(state.xpForNext));
  return notificationPayload({
    kind: 'daily_progress',
    title: 'Today',
    body: `${completed}/${total} quests · 🔥 ${streak} · ${into}/${next} XP`,
    url: state.url,
  });
}

/** Topic replaces an undelivered push with the same tag. Renotify stays false in the SW. */
export function pushRequestOptions(payload: PushPayload): {
  TTL: number;
  headers: { Topic: string; Urgency: 'normal' };
} {
  const topic = payload.tag.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) || 'life-ascension';
  return { TTL: 4 * 60 * 60, headers: { Topic: topic, Urgency: 'normal' } };
}
