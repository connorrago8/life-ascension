/**
 * Loads the signed-in person's own glance, streak, and XP.
 * Companion mode uses that account's companion XP. Adventurer mode uses
 * get_lifetime_xp. Neither path reads the partner's ledger.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { verifiedLifetimeXp } from '../characterXpProof.ts';
import { chicagoToday, todayGlance, type GlanceInstance, type GlanceQuest } from '../homeToday.ts';
import { gameDayParts, parseStreak } from '../questStreak.ts';
import { pillModel, type PillModel } from './pill.ts';

export type PillSnapshot = PillModel & { href: string };

type Mode = 'companion' | 'adventurer' | 'signed-out';

export async function loadPillSnapshot(client: SupabaseClient, userId: string, mode: Mode): Promise<PillSnapshot | null> {
  if (mode === 'signed-out') return null;
  const now = gameDayParts(new Date());
  const today = now.date || chicagoToday();
  const href = '/quests';
  const [xpResult, questsResult, instancesResult, streakResult, wardrobeResult] = await Promise.all([
    client.rpc('get_lifetime_xp'),
    client.from('quests').select('id,cadence,quest_type,scheduled_for,companion_one_shot,fixed_reveal,weekly_weekday').eq('active', true).limit(1000),
    client.from('quest_instances').select('quest_id,due_date,status').eq('owner_id', userId).lte('due_date', today).or(`status.eq.available,due_date.eq.${today}`).limit(1000),
    Promise.resolve(client.rpc('get_quest_streak')).catch(() => ({ data: null, error: true })),
    mode === 'companion'
      ? client.rpc('companion_wardrobe')
      : Promise.resolve({ data: null, error: null }),
  ]);

  const ledgerXp = xpResult.error ? null : verifiedLifetimeXp(xpResult.data);
  const wardrobe = wardrobeResult && !wardrobeResult.error && wardrobeResult.data && typeof wardrobeResult.data === 'object'
    ? wardrobeResult.data as { xp?: unknown }
    : null;
  const xp = mode === 'companion' ? verifiedLifetimeXp(wardrobe?.xp) : ledgerXp;
  if (xp === null) return null;
  if (questsResult.error || instancesResult.error) return null;

  const glance = todayGlance(
    (questsResult.data ?? []) as GlanceQuest[],
    (instancesResult.data ?? []) as GlanceInstance[],
    today,
    { userId, minutesOfDay: now.minutes },
  );
  const streak = streakResult.error ? 0 : (parseStreak(streakResult.data)?.fire ?? 0);
  return { ...pillModel({ completed: glance.done, remaining: glance.left, streak, xp }), href };
}
