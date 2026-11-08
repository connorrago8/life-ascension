-- Reverse 202611080002_companion_bond.sql.
-- Companion rows are removed. Quest XP rows already written are kept.
-- Restores the pre-companion lifetime sum, streak window, equip gate, and award delegate.
-- If the hosted Izzy 2 XP tables are present, the previous 2 XP mint is restored instead.

begin;

drop function if exists public.companion_void_activity(uuid);
drop function if exists public.companion_log_activity(uuid, text, text);
drop function if exists public.companion_complete_quest(uuid);
drop function if exists public.companion_respond_quest(uuid, boolean);
drop function if exists public.companion_send_quest(text, text, date, text);
drop function if exists public.companion_set_identity(text, text);
drop function if exists public.companion_revoke(uuid);
drop function if exists public.companion_accept(text);
drop function if exists public.companion_invite();
drop function if exists public.companion_state();
drop function if exists public.companion_title_key(text);

create or replace function public.quest_has_completion_on(p_owner uuid, p_day date, p_tz text)
returns boolean language sql stable set search_path = ''
as $$
  select exists (
    select 1 from public.xp_ledger
    where owner_id = p_owner
      and awarded_at >= ((p_day::timestamp + interval '5 hours') at time zone p_tz)
      and awarded_at < (((p_day + 1)::timestamp + interval '5 hours') at time zone p_tz))
$$;

create or replace function public.get_lifetime_xp()
returns bigint language sql stable security invoker set search_path = ''
as $$
  select coalesce(sum(amount), 0)::bigint from public.xp_ledger where owner_id = (select auth.uid());
$$;
revoke all on function public.get_lifetime_xp() from public, anon;
grant execute on function public.get_lifetime_xp() to authenticated;

do $$
begin
  if to_regclass('public.izzy_approved_assignments') is not null then
    execute $fn$
create or replace function public._award_quest_xp(p_owner uuid, p_instance uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $award$
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
  return public._award_personal_quest_xp(p_owner, p_instance);
end
$award$
$fn$;
  else
    execute $fn$
create or replace function public._award_quest_xp(p_owner uuid, p_instance uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $award$
begin
  return public._award_personal_quest_xp(p_owner, p_instance);
end
$award$
$fn$;
  end if;
end $$;
revoke all on function public._award_quest_xp(uuid, uuid) from public, anon, authenticated, service_role;

drop table if exists public.xp_ledger_adjustments;
drop table if exists public.companion_activities;
drop table if exists public.companion_quests;
drop table if exists public.companion_identities;
drop table if exists public.companion_bonds;

notify pgrst, 'reload schema';
commit;
