-- Weekly autopilot. Additive and backward-compatible with rows already on this branch.
--
-- Random weeklies (fixed_reveal is null) keep the seeded Mon 00:00–Thu 11:59 reveal.
-- A quest with fixed_reveal appears at local midnight on weekly_weekday (Monday = 1)
-- and can be completed from then. Instances are still one per quest per week:
-- due_date is that week's Monday, so unique(quest_id, due_date) rejects a second row.
-- Home and Quests call ensure_quest_instance with the player's local date.
-- That is local midnight, not the quest-board bulk day that rolls at 05:00 Chicago.
--
-- The Pharmacy weekly pack inserts six career quests for Monday. A second apply
-- skips active titles that already match, case-insensitively. Work-task titles only.
-- No personal health records. Completion stays on the existing +1 XP path.
-- Archive leaves ledger rows in place and stops future instances (ensure requires active).
-- Rename updates quests.title, which every instance of that quest displays.

alter table public.quests add column if not exists fixed_reveal boolean;
alter table public.quests add column if not exists weekly_weekday smallint;

alter table public.quests drop constraint if exists quests_weekly_weekday_check;
alter table public.quests add constraint quests_weekly_weekday_check
  check (weekly_weekday is null or weekly_weekday between 1 and 7);

alter table public.quests drop constraint if exists quests_fixed_reveal_weekday_check;
alter table public.quests add constraint quests_fixed_reveal_weekday_check
  check (fixed_reveal is not true or weekly_weekday between 1 and 7);

create or replace function public.quest_title_key(p_title text)
returns text language sql immutable strict set search_path = ''
as $$
  select lower(pg_catalog.regexp_replace(pg_catalog.btrim(p_title), '[[:space:]]+', ' ', 'g'))
$$;
revoke all on function public.quest_title_key(text) from public, anon, authenticated;

-- Fixed reveal: local midnight on the assigned weekday. Otherwise the seeded window.
create or replace function public.quest_weekly_appears_at(p_owner uuid, p_quest uuid, p_week date, p_tz text)
returns timestamptz language plpgsql stable strict set search_path = ''
as $$
declare v_fixed boolean; v_dow integer;
begin
  select q.fixed_reveal, q.weekly_weekday into v_fixed, v_dow from public.quests q where q.id = p_quest;
  if v_fixed is true then
    return (((p_week + (coalesce(v_dow, 1) - 1))::timestamp) at time zone p_tz);
  end if;
  return ((p_week::timestamp
    + pg_catalog.make_interval(mins => (public.quest_fnv1a(p_owner::text || ':' || p_quest::text || ':' || p_week::text) % 5040)::integer))
    at time zone p_tz);
end $$;
revoke all on function public.quest_weekly_appears_at(uuid, uuid, date, text) from public, anon, authenticated;

create or replace function public.ensure_quest_instance(p_quest_id uuid,p_date date default ((pg_catalog.now() at time zone public.quest_timezone(auth.uid()))::date))
returns uuid language plpgsql security definer set search_path = ''
as $$
declare q public.quests%rowtype; v_id uuid; v_today date; v_date date := p_date; v_reveal date;
begin
 v_today := (pg_catalog.now() at time zone public.quest_timezone(auth.uid()))::date;
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if p_date is null or p_date < v_today-30 or p_date > v_today+1 then raise exception 'Date outside allowed window'; end if;
 select * into q from public.quests where id=p_quest_id and owner_id=auth.uid() and active;
 if not found then raise exception 'Quest not found'; end if;
 if q.scheduled_for is not null and p_date < q.scheduled_for
    and not (q.cadence = 'weekly' and public.quest_week_start(p_date) >= public.quest_week_start(q.scheduled_for)) then
  raise exception 'Quest not yet scheduled';
 end if;
 if q.cadence = 'daily' and p_date < v_today - 2 then
  raise exception 'Daily instances cannot be opened before the last 2 days';
 end if;
 if q.cadence = 'weekly' then
  v_date := public.quest_week_start(p_date);
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(q.id::text,0));
 if q.cadence='once' then
   select id into v_id from public.quest_instances where quest_id=q.id limit 1;
   if found then return v_id; end if;
 end if;
 -- A fixed weekday does not open until that local day. Monday (1) opens with the week.
 if q.cadence = 'weekly' and q.fixed_reveal is true then
  v_reveal := v_date + (coalesce(q.weekly_weekday::integer, 1) - 1);
  if p_date < v_reveal then
   select id into v_id from public.quest_instances where quest_id=q.id and due_date=v_date;
   return v_id;
  end if;
 end if;
 insert into public.quest_instances(owner_id,quest_id,due_date)
 values(auth.uid(),q.id,v_date)
 on conflict(quest_id,due_date) do update set due_date=excluded.due_date returning id into v_id;
 return v_id;
end $$;
revoke all on function public.ensure_quest_instance(uuid,date) from public,anon;
grant execute on function public.ensure_quest_instance(uuid,date) to authenticated;

-- Weekly edits keep the Monday due_date (the week key) and the earned rows.
create or replace function public.reschedule_quest(p_quest_id uuid,p_date date)
returns void language plpgsql security definer set search_path=''
as $$
declare q public.quests%rowtype; v_today date;
begin
 if (select auth.uid()) is null then raise exception 'Sign-in required'; end if;
 v_today := (now() at time zone 'America/Chicago')::date;
 if p_date is null or p_date < v_today-30 or p_date > v_today+366 then raise exception 'Date outside scheduling window'; end if;
 select * into q from public.quests where id=p_quest_id and owner_id=(select auth.uid()) and active=true for update;
 if not found then raise exception 'Active quest not found'; end if;
 if q.cadence='once' and exists(select 1 from public.quest_instances where quest_id=q.id and status='completed') then
  raise exception 'Completed quests cannot be rescheduled'; end if;
 if q.cadence='daily' then
  if p_date > v_today then
   update public.quest_instances set status='deferred'
    where quest_id=q.id and due_date=v_today and status='available';
  end if;
  update public.quests set scheduled_for=p_date where id=q.id;
  return;
 end if;
 if q.cadence='weekly' then
  update public.quests
     set scheduled_for=p_date,
         weekly_weekday=case when fixed_reveal is true then pg_catalog.date_part('isodow', p_date)::integer else weekly_weekday end
   where id=q.id;
  return;
 end if;
 if q.quest_type <> 'goal' and q.scheduled_for is null then
  raise exception 'Legacy scheduled chore requires scheduled date backfill'; end if;
 if q.quest_type <> 'goal' and p_date < greatest(v_today,q.scheduled_for) then
  raise exception 'Scheduled chores cannot be moved earlier'; end if;
 if exists(select 1 from public.quest_instances where quest_id=q.id and due_date=p_date) then
  raise exception 'An instance already exists on this date'; end if;
 update public.quest_instances set due_date=p_date where quest_id=q.id and status<>'completed';
 update public.quests set scheduled_for=p_date where id=q.id;
end $$;
revoke all on function public.reschedule_quest(uuid,date) from public,anon;
grant execute on function public.reschedule_quest(uuid,date) to authenticated;

create or replace function public._insert_weekly_autopilot_quest(p_owner uuid, p_title text, p_domain text, p_weekday integer)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid; v_title text := pg_catalog.btrim(p_title); v_week date;
begin
 if p_owner is null then raise exception 'User id required'; end if;
 if v_title is null or char_length(v_title) not between 1 and 120 then raise exception 'Invalid title'; end if;
 if p_domain not in ('hygiene','home','mental_health','personal_growth','finance','career','relationships','physical_health') then raise exception 'Invalid domain'; end if;
 if p_weekday is null or p_weekday not between 1 and 7 then raise exception 'Invalid weekday'; end if;
 v_week := public.quest_week_start((pg_catalog.now() at time zone public.quest_timezone(p_owner))::date);
 insert into public.quests(owner_id,title,domain,cadence,scheduled_for,quest_type,xp,active,fixed_reveal,weekly_weekday)
 values (p_owner, v_title, p_domain, 'weekly', v_week, 'scheduled', 1, true, true, p_weekday)
 returning id into v_id;
 return v_id;
end $$;
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
as $$
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
    where owner_id = p_owner and active
      and public.quest_title_key(title) = public.quest_title_key(v_title)
  ) then
    continue;
  end if;
  perform public._insert_weekly_autopilot_quest(p_owner, v_title, 'career', 1);
  v_added := v_added + 1;
 end loop;
 return v_added;
end $$;
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

-- Admin/service helper. Not granted to signed-in players, so it cannot target another account from the app.
create or replace function public.apply_pharmacy_weekly_pack_for_user(p_owner uuid)
returns integer language plpgsql security definer set search_path = ''
as $$
begin
 if p_owner is null then raise exception 'User id required'; end if;
 return public._apply_pharmacy_weekly_pack(p_owner);
end $$;
revoke all on function public.apply_pharmacy_weekly_pack_for_user(uuid) from public, anon, authenticated;
grant execute on function public.apply_pharmacy_weekly_pack_for_user(uuid) to service_role;

-- Pack and autopilot titles must not silently become a companion task.
create or replace function public.quest_companion_assign_to_owner(p_companion_id uuid,p_title text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_owner uuid := auth.uid(); v_title text := btrim(p_title); v_quest uuid;
begin
 if v_owner is null then raise exception 'Authentication required'; end if;
 if v_title is null or char_length(v_title) not between 1 and 120 then raise exception 'Invalid quest title'; end if;
 v_title := regexp_replace(v_title,'[[:space:]]+',' ','g');
 if not exists(select 1 from public.quest_companions where id=p_companion_id and owner_id=v_owner and consent_confirmed_at is not null) then raise exception 'Companion unavailable'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_owner::text || ':' || lower(regexp_replace(v_title,'[[:space:]]+',' ','g')),0));
 select id into v_quest from public.quests
 where owner_id=v_owner and active
   and public.quest_title_key(title)=public.quest_title_key(v_title)
   and fixed_reveal is not true
   and not (cadence='weekly' and domain='career')
 order by created_at asc limit 1;
 if v_quest is null then
  insert into public.quests(owner_id,title,domain,cadence,xp,active)
  values(v_owner,v_title,'relationships','once',1,true) returning id into v_quest;
 end if;
 insert into public.quest_companion_assignments(owner_id,companion_id,quest_id,requested_title)
 values(v_owner,p_companion_id,v_quest,v_title)
 on conflict(owner_id,companion_id,quest_id) do update set active=true,requested_title=excluded.requested_title;
 return v_quest;
end $$;
revoke all on function public.quest_companion_assign_to_owner(uuid,text) from public,anon;
grant execute on function public.quest_companion_assign_to_owner(uuid,text) to authenticated;

notify pgrst, 'reload schema';
