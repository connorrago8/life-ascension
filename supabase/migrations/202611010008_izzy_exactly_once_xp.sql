-- IZ-9: Exactly-once +2 XP for approved Izzy quest instances.
-- This overrides only the internal award helper used by the existing
-- set_quest_instance_status transaction. The quest's base XP remains 1.
-- Fail closed for inactive consent or mismatched approval.
create or replace function public._award_quest_xp(p_owner uuid, p_instance uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_id uuid;
  v_amount integer := 1;
begin
  if exists (
    select 1
      from public.izzy_approved_assignments a
      join public.quest_instances i
        on i.id = a.quest_instance_id
       and i.owner_id = a.owner_id
       and i.quest_id = a.quest_id
     where a.owner_id = p_owner
       and a.quest_instance_id = p_instance
       and a.origin = 'izzy'
       and a.consent_at is not null
       and a.consent_revoked_at is null
  ) then
    v_amount := 2;
  end if;

  insert into public.xp_ledger
    (owner_id, instance_id, amount, base_amount, streak_fire, first_of_day)
  values (p_owner, p_instance, v_amount, 1, null, null)
  on conflict (instance_id) do nothing
  returning id into v_id;

  return jsonb_build_object(
    'awarded', v_id is not null,
    'amount', case when v_id is null then 0 else v_amount end,
    'base', 1,
    'fire', null,
    'first_of_day', null
  );
end;
$$;

-- Preserve helper execution posture: no new client grant is added here.
comment on function public._award_quest_xp(uuid,uuid) is
  'Exactly-once quest award: ordinary instances +1; consented approved Izzy instances +2. The unique xp_ledger.instance_id enforces idempotency.';
