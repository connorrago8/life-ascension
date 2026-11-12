-- Weekday-assigned weekly quests open at 05:00 local on their weekday.
-- Reverse with supabase/rollbacks/20261112011949_pharmacy_weekly_autopilot_down.sql.
--
-- The game day is still public.quest_game_day (profile time zone, America/Chicago
-- fallback). Monday 04:59 stays in the previous week. Monday 05:00 opens this week.
-- Unassigned weeklies keep the seeded Monday 05:00–Thursday noon reveal.
-- A fixed weekday uses ((week + weekday - 1) at 05:00) at time zone tz, so both
-- DST transitions keep a real 05:00 wall time.
--
-- One instance per quest per week: due_date stays that week's Monday, and
-- unique(quest_id, due_date) rejects a second row. Existing quests and ledger
-- rows are not rewritten. Completion stays on the existing personal streak:
-- round half up of base 10 times (1 + 0.1 F), one global daily streak.
-- This file does not mint and does not add a companion bonus.
--
-- The Pharmacy weekly pack adds six career Monday quests. A title the player
-- already has, including an archived row, is skipped. Work-task titles only.

alter table public.quests add column if not exists fixed_reveal boolean;
alter table public.quests add column if not exists weekly_weekday smallint;

alter table public.quests drop constraint if exists quests_weekly_weekday_check;
alter table public.quests add constraint quests_weekly_weekday_check
  check (weekly_weekday is null or weekly_weekday between 1 and 7);

alter table public.quests drop constraint if exists quests_fixed_reveal_weekday_check;
alter table public.quests add constraint quests_fixed_reveal_weekday_check
  check (fixed_reveal is not true or weekly_weekday between 1 and 7);

do $$
declare
  ensure_body text := pg_catalog.pg_get_functiondef('public.ensure_quest_instance(uuid,date)'::regprocedure);
  place_body text := pg_catalog.pg_get_functiondef('public._place_companion_quest(uuid)'::regprocedure);
begin
  if position('fixed_reveal' in ensure_body) = 0
     and (position('companion_one_shot' in ensure_body) = 0
       or position('quest_game_day' in ensure_body) = 0) then
    raise exception 'Refusing to replace ensure_quest_instance: expected the 05:00 companion body';
  end if;
  if position('fixed_reveal is not true' in place_body) = 0
     and position('companion_title_key' in place_body) = 0 then
    raise exception 'Refusing to replace _place_companion_quest: expected the companion title match';
  end if;
end $$;

-- Drop so the body can change from sql to plpgsql. Callers are plpgsql and do
-- not pin a dependency that would block the drop inside this transaction.
drop function if exists public.quest_weekly_appears_at(uuid, uuid, date, text);

create function public.quest_weekly_appears_at(p_owner uuid, p_quest uuid, p_week date, p_tz text)
returns timestamptz language plpgsql stable strict set search_path = ''
as $appears$
declare v_fixed boolean; v_dow integer;
begin
  select q.fixed_reveal, q.weekly_weekday into v_fixed, v_dow
    from public.quests q
    where q.id = p_quest;
  if v_fixed is true and v_dow between 1 and 7 then
    return (((p_week + (v_dow - 1))::timestamp + interval '5 hours') at time zone p_tz);
  end if;
  return ((p_week::timestamp + interval '5 hours'
    + pg_catalog.make_interval(mins => (public.quest_fnv1a(p_owner::text || ':' || p_quest::text || ':' || p_week::text) % 4740)::integer))
    at time zone p_tz);
end
$appears$;
revoke all on function public.quest_weekly_appears_at(uuid, uuid, date, text) from public, anon, authenticated;

-- Companion one-shots keep the single original day or week from 202611080004.
-- A fixed weekday does not insert this week's row until 05:00 local on that day.
create or replace function public.ensure_quest_instance(p_quest_id uuid,p_date date default public.quest_today())
returns uuid language plpgsql security definer set search_path = ''
as $ensure$
declare q public.quests%rowtype; v_id uuid; v_today date; v_date date := p_date; v_reveal timestamptz;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 v_today := public.quest_game_day(pg_catalog.now(), public.quest_timezone(auth.uid()));
 if p_date is null then p_date := v_today; v_date := v_today; end if;
 if p_date < v_today-30 or p_date > v_today+1 then raise exception 'Date outside allowed window'; end if;
 select * into q from public.quests where id=p_quest_id and owner_id=auth.uid() and active;
 if not found then raise exception 'Quest not found'; end if;
 if q.companion_one_shot and q.cadence = 'daily' then
  v_date := coalesce(q.scheduled_for, p_date);
 elsif q.companion_one_shot and q.cadence = 'weekly' then
  v_date := public.quest_week_start(coalesce(q.scheduled_for, p_date));
 elsif q.cadence = 'weekly' then
  v_date := public.quest_week_start(p_date);
 end if;
 if q.companion_one_shot then
  select id into v_id from public.quest_instances where quest_id = q.id and due_date = v_date and owner_id = auth.uid();
  if v_id is not null then return v_id; end if;
 end if;
 if q.scheduled_for is not null and p_date < q.scheduled_for
    and not (q.cadence = 'weekly' and public.quest_week_start(p_date) >= public.quest_week_start(q.scheduled_for)) then
  raise exception 'Quest not yet scheduled';
 end if;
 if q.cadence = 'daily' and p_date < v_today - 2 and not q.companion_one_shot then
  raise exception 'Daily instances cannot be opened before the last 2 days';
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(q.id::text,0));
 if q.cadence='once' then
   select id into v_id from public.quest_instances where quest_id=q.id limit 1;
   if found then return v_id; end if;
 end if;
 if q.cadence = 'weekly' and q.fixed_reveal is true and not q.companion_one_shot then
  v_reveal := public.quest_weekly_appears_at(auth.uid(), q.id, v_date, public.quest_timezone(auth.uid()));
  if pg_catalog.now() < v_reveal then
   select id into v_id from public.quest_instances where quest_id=q.id and due_date=v_date and owner_id=auth.uid();
   return v_id;
  end if;
 end if;
 insert into public.quest_instances(owner_id,quest_id,due_date)
 values(auth.uid(),q.id,v_date)
 on conflict(quest_id,due_date) do update set due_date=excluded.due_date returning id into v_id;
 return v_id;
end
$ensure$;
revoke all on function public.ensure_quest_instance(uuid,date) from public,anon;
grant execute on function public.ensure_quest_instance(uuid,date) to authenticated;

-- A companion request must not attach to a weekday-assigned quest or a career weekly.
create or replace function public._place_companion_quest(p_quest uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $place$
declare
  q public.companion_quests%rowtype;
  v_today date;
  v_due date;
  v_norm text;
  v_cadence text;
  v_quest uuid;
  v_inst uuid;
  v_status text;
  v_instance_due date;
begin
  select * into q from public.companion_quests where id = p_quest for update;
  if not found then raise exception 'Quest not found'; end if;
  if q.status in ('declined') then
    return jsonb_build_object('status', q.status, 'instanceId', q.instance_id);
  end if;
  if q.status in ('accepted','completed') and q.instance_id is not null then
    return jsonb_build_object('status', q.status, 'instanceId', q.instance_id, 'dueOn', q.due_on, 'cadence',
      (select cadence from public.quests where id = q.quest_id));
  end if;
  v_today := public.quest_game_day(pg_catalog.now(), public.quest_timezone(q.to_user));
  v_due := coalesce(q.due_on, v_today);
  if v_due < v_today - 30 or v_due > v_today + 366 then raise exception 'Date out of range'; end if;
  v_cadence := case when q.cadence = 'weekly' then 'weekly' else 'daily' end;
  v_norm := public.companion_title_key(q.title);
  v_instance_due := case when v_cadence = 'weekly' then public.quest_week_start(v_due) else v_due end;
  select existing.id, i.id, i.status into v_quest, v_inst, v_status
    from public.quests existing
    join public.quest_instances i on i.quest_id = existing.id and i.owner_id = existing.owner_id
    where existing.owner_id = q.to_user and existing.active
      and existing.fixed_reveal is not true
      and not (existing.cadence = 'weekly' and existing.domain = 'career')
      and public.companion_title_key(existing.title) = v_norm
      and i.due_date = v_instance_due
    order by (i.status = 'available') desc, i.created_at desc
    limit 1;
  if v_inst is null then
    insert into public.quests(owner_id, title, domain, cadence, scheduled_for, quest_type, companion_one_shot)
      values (q.to_user, q.title, 'relationships', v_cadence, v_due, 'scheduled', true)
      returning id into v_quest;
    insert into public.quest_instances(owner_id, quest_id, due_date)
      values (q.to_user, v_quest, v_instance_due)
      returning id into v_inst;
    v_status := 'available';
  end if;
  update public.companion_quests
    set status = case when v_status = 'completed' then 'completed' else 'accepted' end,
        due_on = v_due,
        quest_id = v_quest,
        instance_id = v_inst,
        accepted_at = coalesce(accepted_at, pg_catalog.now()),
        completed_at = case when v_status = 'completed' then coalesce(completed_at, pg_catalog.now()) else completed_at end
    where id = q.id;
  return jsonb_build_object(
    'status', case when v_status = 'completed' then 'completed' else 'accepted' end,
    'questId', q.id,
    'instanceId', v_inst,
    'dueOn', v_due,
    'cadence', v_cadence);
end
$place$;
revoke all on function public._place_companion_quest(uuid) from public, anon, authenticated, service_role;

create or replace function public.quest_title_key(p_title text)
returns text language sql immutable strict set search_path = ''
as $$
  select pg_catalog.lower(pg_catalog.regexp_replace(pg_catalog.btrim(p_title), '\s+', ' ', 'g'))
$$;
revoke all on function public.quest_title_key(text) from public, anon, authenticated;

create or replace function public._insert_weekly_autopilot_quest(p_owner uuid, p_title text, p_domain text, p_weekday integer)
returns uuid language plpgsql security definer set search_path = ''
as $ins$
declare v_id uuid; v_title text := pg_catalog.btrim(p_title); v_week date; v_scheduled date;
begin
 if p_owner is null then raise exception 'User id required'; end if;
 if v_title is null or char_length(v_title) not between 1 and 120 then raise exception 'Invalid title'; end if;
 if p_domain not in ('hygiene','home','mental_health','personal_growth','finance','career','relationships','physical_health') then raise exception 'Invalid domain'; end if;
 if p_weekday is null or p_weekday not between 1 and 7 then raise exception 'Invalid weekday'; end if;
 v_week := public.quest_week_start(public.quest_game_day(pg_catalog.now(), public.quest_timezone(p_owner)));
 v_scheduled := v_week + (p_weekday - 1);
 insert into public.quests(owner_id, title, domain, cadence, scheduled_for, quest_type, active, fixed_reveal, weekly_weekday)
 values (p_owner, v_title, p_domain, 'weekly', v_scheduled, 'scheduled', true, true, p_weekday)
 returning id into v_id;
 return v_id;
end
$ins$;
revoke all on function public._insert_weekly_autopilot_quest(uuid, text, text, integer) from public, anon, authenticated, service_role;

create or replace function public.create_weekly_autopilot_quest(p_title text, p_domain text, p_weekday integer)
returns uuid language plpgsql security definer set search_path = ''
as $$
begin
 if auth.uid() is null then raise exception 'Sign-in required'; end if;
 return public._insert_weekly_autopilot_quest(auth.uid(), p_title, p_domain, p_weekday);
end $$;
revoke all on function public.create_weekly_autopilot_quest(text, text, integer) from public, anon;
grant execute on function public.create_weekly_autopilot_quest(text, text, integer) to authenticated;

create or replace function public._apply_pharmacy_weekly_pack(p_owner uuid)
returns integer language plpgsql security definer set search_path = ''
as $pack$
declare
  v_title text;
  v_added integer := 0;
  v_titles text[] := array[
    'Tech schedule',
    'Pharmacist schedule',
    'Supplies order',
    'U Learn check',
    'Attendance check',
    'PTO check'
  ];
begin
 if p_owner is null then raise exception 'User id required'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('pharmacy-weekly:' || p_owner::text, 0));
 foreach v_title in array v_titles loop
  if exists (
    select 1 from public.quests
    where owner_id = p_owner
      and public.quest_title_key(title) = public.quest_title_key(v_title)
  ) then
    continue;
  end if;
  perform public._insert_weekly_autopilot_quest(p_owner, v_title, 'career', 1);
  v_added := v_added + 1;
 end loop;
 return v_added;
end
$pack$;
revoke all on function public._apply_pharmacy_weekly_pack(uuid) from public, anon, authenticated, service_role;

create or replace function public.apply_pharmacy_weekly_pack()
returns integer language plpgsql security definer set search_path = ''
as $$
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 return public._apply_pharmacy_weekly_pack(auth.uid());
end $$;
revoke all on function public.apply_pharmacy_weekly_pack() from public, anon;
grant execute on function public.apply_pharmacy_weekly_pack() to authenticated;

-- Not granted to signed-in players. A service role may install the pack for one account.
create or replace function public.apply_pharmacy_weekly_pack_for_user(p_owner uuid)
returns integer language plpgsql security definer set search_path = ''
as $$
begin
 if p_owner is null then raise exception 'User id required'; end if;
 return public._apply_pharmacy_weekly_pack(p_owner);
end $$;
revoke all on function public.apply_pharmacy_weekly_pack_for_user(uuid) from public, anon, authenticated;
grant execute on function public.apply_pharmacy_weekly_pack_for_user(uuid) to service_role;

notify pgrst, 'reload schema';
