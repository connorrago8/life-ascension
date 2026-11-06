-- Founder-approved base-10 quest XP (t673u). TEST only: njqwwimzrsunheehnnnt.
-- The live TEST mint already includes a separate Izzy 2-XP path; preserve it exactly while
-- moving ordinary daily/off-board/weekly completion to the below personal-streak helper.
-- Existing ledger rows are never rewritten. No grants, RLS, level curve or Crypt functions change.
-- Reverse with 202611060001_quest_base_xp10_down.sql.

alter table public.xp_ledger drop constraint if exists xp_ledger_base_amount_check;
alter table public.xp_ledger add constraint xp_ledger_base_amount_check
  check (base_amount is null or base_amount >= 1);

create or replace function public.quest_streak_xp(p_base integer, p_fire integer, p_first boolean)
returns integer language sql immutable strict set search_path = ''
as $$ select case when p_first then p_base else ((p_base::bigint * (10 + greatest(p_fire, 0)) + 5) / 10)::integer end $$;

do $$ declare body text := pg_catalog.pg_get_functiondef('public._award_quest_xp(uuid,uuid)'::regprocedure);
begin
 if body <> $observed$CREATE OR REPLACE FUNCTION public._award_quest_xp(p_owner uuid, p_instance uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
      join public.quest_companion_assignments ca
        on ca.id = a.companion_assignment_id
       and ca.owner_id = a.owner_id
       and ca.quest_id = a.quest_id
      join public.quest_companions c
        on c.id = ca.companion_id
       and c.owner_id = a.owner_id
     where a.owner_id = p_owner
       and a.quest_instance_id = p_instance
       and a.origin = 'izzy'
       and a.consent_at is not null
       and a.consent_revoked_at is null
       and ca.active = true
       and c.consent_confirmed_at is not null
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
$function$
$observed$ then raise exception 'Unexpected TEST XP mint. Refuse to replace unreviewed changes'; end if;
 if body like '%return public._award_personal_quest_xp(p_owner,p_instance);%' or body like '%return public._award_personal_quest_xp(p_owner, p_instance);%' then return; end if;
end $$;

create or replace function public._award_personal_quest_xp(p_owner uuid, p_instance uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_tz text := public.quest_timezone(p_owner);
  v_today date; v_first boolean; v_fire integer; v_amount integer; v_id uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('quest-streak:' || p_owner::text, 0));
  v_today := (pg_catalog.now() at time zone v_tz)::date;
  v_first := not public.quest_has_completion_on(p_owner, v_today, v_tz);
  v_fire := public.quest_streak_fire(p_owner, v_today, v_tz);
  v_amount := public.quest_streak_xp(10, v_fire, v_first);
  insert into public.xp_ledger(owner_id, instance_id, amount, base_amount, streak_fire, first_of_day)
  values (p_owner, p_instance, v_amount, 10, v_fire, v_first)
  on conflict (instance_id) do nothing returning id into v_id;
  return jsonb_build_object('awarded', v_id is not null, 'amount', case when v_id is null then 0 else v_amount end,
    'base', 10, 'fire', v_fire, 'first_of_day', v_first);
end $$;
revoke all on function public._award_personal_quest_xp(uuid,uuid) from public,anon,authenticated,service_role;

-- Replace only the observed TEST companion delegation. Any different body fails closed.
create or replace function public._award_quest_xp(p_owner uuid, p_instance uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_id uuid; v_amount integer := 1;
begin
  if exists (
    select 1
      from public.izzy_approved_assignments a
      join public.quest_instances i
        on i.id = a.quest_instance_id
       and i.owner_id = a.owner_id
       and i.quest_id = a.quest_id
      join public.quest_companion_assignments ca
        on ca.id = a.companion_assignment_id
       and ca.owner_id = a.owner_id
       and ca.quest_id = a.quest_id
      join public.quest_companions c
        on c.id = ca.companion_id
       and c.owner_id = a.owner_id
     where a.owner_id = p_owner
       and a.quest_instance_id = p_instance
       and a.origin = 'izzy'
       and a.consent_at is not null
       and a.consent_revoked_at is null
       and ca.active = true
       and c.consent_confirmed_at is not null
  ) then
    v_amount := 2;
    insert into public.xp_ledger(owner_id,instance_id,amount,base_amount,streak_fire,first_of_day)
    values (p_owner,p_instance,v_amount,1,null,null)
    on conflict (instance_id) do nothing returning id into v_id;
    return jsonb_build_object('awarded',v_id is not null,'amount',case when v_id is null then 0 else v_amount end,
      'base',1,'fire',null,'first_of_day',null);
  end if;
  return public._award_personal_quest_xp(p_owner,p_instance);
end $$;
revoke all on function public._award_quest_xp(uuid,uuid) from public,anon,authenticated,service_role;

-- Service-role MCP delegation preserves input actor binding. Unlike the older legacy status
-- RPC, this new wrapper returns the server's authoritative XP receipt; it never accepts one.
create or replace function public.set_quest_instance_status_with_receipt_as_user(
  p_user_id uuid, p_instance_id uuid, p_action text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
begin
  if p_user_id is null then raise exception 'User ID required'; end if;
  perform public._bind_service_role_user(p_user_id);
  return public.set_quest_instance_status_v2(p_instance_id,p_action);
end $$;
revoke all on function public.set_quest_instance_status_with_receipt_as_user(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.set_quest_instance_status_with_receipt_as_user(uuid,uuid,text) to service_role;
