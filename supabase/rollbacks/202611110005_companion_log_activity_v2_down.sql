-- Reverse companion_log_activity_v2. TEST only.
-- Restores lifetime XP and void to the pre-v2 definitions (ledger + adjustments only).

create or replace function public._companion_lifetime_xp(p_owner uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select (
    coalesce((select sum(amount) from public.xp_ledger where owner_id = p_owner), 0)
    + coalesce((select sum(amount) from public.xp_ledger_adjustments where owner_id = p_owner), 0)
  )::bigint
$$;
revoke all on function public._companion_lifetime_xp(uuid) from public, anon, authenticated, service_role;

create or replace function public.companion_void_activity(p_activity uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  u uuid := auth.uid();
  a public.companion_activities%rowtype;
  v_amount integer;
begin
  if u is null then raise exception 'Sign-in required'; end if;
  select * into a from public.companion_activities where id = p_activity for update;
  if not found or u not in (a.recorded_by, a.subject_id) then raise exception 'Activity not found'; end if;
  if a.voided_at is not null then
    return jsonb_build_object('voided', true, 'already', true);
  end if;
  select amount into v_amount from public.xp_ledger where id = a.ledger_id and owner_id = a.subject_id;
  if v_amount is null or v_amount < 1 then raise exception 'Activity not found'; end if;
  insert into public.xp_ledger_adjustments(owner_id, ledger_id, amount, reason)
    values (a.subject_id, a.ledger_id, -v_amount, 'companion_activity_void')
    on conflict (ledger_id) do nothing;
  update public.companion_activities
    set voided_at = pg_catalog.now(), voided_by = u
    where id = a.id;
  return jsonb_build_object('voided', true, 'already', false, 'reversed', v_amount);
end $$;
revoke all on function public.companion_void_activity(uuid) from public, anon;
grant execute on function public.companion_void_activity(uuid) to authenticated;

drop function if exists public.companion_log_activity_v2(uuid, text, text, text, date);

alter table public.companion_activities drop constraint if exists companion_activities_xp_awarded_check;
alter table public.companion_activities drop column if exists xp_awarded;

notify pgrst, 'reload schema';
