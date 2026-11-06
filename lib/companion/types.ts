export type CompanionPair = { id: string; status: 'pending' | 'requested' | 'active' | 'revoked'; yourRole: 'sender' | 'recipient'; canConfirm: boolean; otherUserId: string | null; name: string };
export type CompanionOffer = { id: string; pairId: string; title: string; category: string; difficulty: string | null; dueDate: string | null; rainCheckUntil: string | null; instanceId: string | null; incoming: boolean; status: 'pending' | 'accepted' | 'declined' | 'rain-check' | 'completed'; hasReward: boolean; mystery: boolean; reward: string | null };
export type CompanionDashboard = { viewerId: string; personalXp: number; pairs: CompanionPair[]; quests: CompanionOffer[]; overlaps: { id: string; title: string; completed: boolean }[] };
const SAFE_MESSAGES = new Set([
  'Invitation unavailable', 'Choose your companion role', 'Companionship unavailable', 'Quest unavailable',
  'Only the agreed sender can assign quests', 'A title and send identifier are required', 'Invalid category',
  'Text is too long', 'A mystery needs a reward promise', 'Due date must be within the next year',
  'This send attempt already exists; refresh before editing', 'Only pending quests can be declined',
  'Overlap must be your active quest for today', 'This task already has companion credit',
  'Accept this quest first', 'This task is already completed', 'Choose a rain-check date within the next year',
  'Companion conflict; refresh before retrying', 'Invalid companion request', 'Sign-in required',
]);
export function companionError(code?: string, message?: string): string {
  if (code === 'P0001' && message && SAFE_MESSAGES.has(message)) return message;
  return ['PGRST202', '42883', '42P01'].includes(code ?? '')
    ? 'The companion service is not available on this build yet. Your quests and XP were not changed.'
    : 'Could not confirm the request. Refresh shared status before retrying; do not assume it was saved.';
}
