export type QuestReceipt = {
  schema_version: 1; quest_instance_id: string;
  status: 'available'|'completed'|'deferred'; quest_completion_confirmed: boolean;
  reward_confirmed: boolean; xp_awarded: 0|1;
  reward_status: 'awarded'|'already_awarded'|'not_awarded'; reward_awarded_at: string|null;
};
export function questReceipt(value: unknown, instanceId: string): QuestReceipt | null {
  if (!value || typeof value !== 'object') return null;
  const r = value as QuestReceipt;
  if(r.schema_version!==1 || r.quest_instance_id!==instanceId ||
    !['available','completed','deferred'].includes(r.status) ||
    typeof r.reward_confirmed!=='boolean' || typeof r.quest_completion_confirmed!=='boolean' ||
    ![0,1].includes(r.xp_awarded) || !['awarded','already_awarded','not_awarded'].includes(r.reward_status) ||
    r.quest_completion_confirmed!==(r.status==='completed')) return null;
  if(r.reward_confirmed && (!r.quest_completion_confirmed || typeof r.reward_awarded_at!=='string' || !Number.isFinite(Date.parse(r.reward_awarded_at)))) return null;
  if(r.xp_awarded===1 && (!r.reward_confirmed || r.reward_status!=='awarded')) return null;
  if(r.reward_status==='awarded' && r.xp_awarded!==1) return null;
  if(r.reward_status==='already_awarded' && (!r.reward_confirmed || r.xp_awarded!==0)) return null;
  if(r.reward_status==='not_awarded' && (r.reward_confirmed || r.xp_awarded!==0)) return null;
  return r;
}
export const CADENCE_LABELS = {daily:'Daily',weekly:'Weekly',biweekly:'Every 2 weeks',once:'One-time'} as const;
export function calendarDateOffset(day:string, days:number):string {
  const [y,m,d]=day.split('-').map(Number);
  return new Date(Date.UTC(y,m-1,d+days)).toISOString().slice(0,10);
}
