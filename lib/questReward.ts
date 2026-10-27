/** UI-only gate for an eventual quest-specific, server-confirmed XP award.
 * This does not award XP or infer attribution from lifetime totals.
 * Alpha must validate the authoritative RPC contract before enabling reward toasts.
 */
export type ConfirmedQuestReward = { levelUp: boolean };
export function confirmedQuestReward(value: unknown, expectedInstanceId: string): ConfirmedQuestReward | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  // Proposed contract: a quest-scoped event explicitly confirmed by the server.
  if (v.reward_confirmed !== true || v.quest_completion_confirmed !== true || v.xp_awarded !== 1 || typeof v.quest_instance_id !== 'string' || v.quest_instance_id !== expectedInstanceId) return null;
  return { levelUp: v.level_up === true };
}
