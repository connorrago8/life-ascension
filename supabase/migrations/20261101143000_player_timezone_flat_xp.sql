-- Player time zone and a flat +1 XP award.
-- Runs after the streak and companion migrations.
--
-- Day boundary: profiles.timezone when it is a real IANA zone, otherwise America/Chicago.
-- The client saves the device zone through set_player_timezone. XP math does not trust the
-- client: this migration only stores the zone and uses it as a calendar boundary.
--
-- XP: every real quest completion inserts one xp_ledger row with amount 1.
-- A repeated complete, refresh, or retry hits ON CONFLICT (instance_id) and awards 0.
-- Streak bonuses are not minted. Fire is a per-quest display count, not extra XP.
-- A missed local day resets that quest's fire. No grace day is granted
-- (the allowance is zero, which is inside "at most one grace day per seven days").
--
-- Does not change RLS policies, grants on tables, or auth.

alter table public.profiles add column if not exists timezone text;

create or replace function public.quest_timezone(p_owner uuid)
returns text language plpgsql stable set search_path = ''
as $$
declare v_tz text;
begin
  select pg_catalog.to_jsonb(p) ->> 'timezone' into v_tz from public.profiles p where p.id = p_owner;
  if v_tz is not null and exists (select 1 from pg_catalog.pg_timezone_names where name = v_tz) then
    return v_tz;
  end if;
  return 'America/Chicago';
end $$;
revoke all on function public.quest_timezone(uuid) from public, anon, authenticated;

create or replace function public.set_player_timezone(p_tz text)
returns text language plpgsql security definer set search_path = ''
as $$
declare v_owner uuid := auth.uid();
begin
  if v_owner is null then raise exception 'Authentication required'; end if;
  if p_tz is null or not exists (select 1 from pg_catalog.pg_timezone_names where name = p_tz) then
    raise exception 'Invalid time zone';
  end if;
  insert into public.profiles (id, timezone) values (v_owner, p_tz)
  on conflict (id) do update set timezone = excluded.timezone;
  return p_tz;
end $$;
revoke all on function public.set_player_timezone(text) from public, anon;
grant execute on function public.set_player_timezone(text) to authenticated;

alter table public.xp_ledger add column if not exists base_amount integer;
alter table public.xp_ledger add column if not exists streak_fire integer;
alter table public.xp_ledger add column if not exists first_of_day boolean;
alter table public.xp_ledger drop constraint if exists xp_ledger_amount_check;
alter table public.xp_ledger add constraint xp_ledger_amount_check check (amount >= 1);

-- 4. Creation and instances (0007 bodies + weekly) -------------------------------------------
create or replace function public.create_scheduled_quest(p_title text,p_domain text,p_cadence text,p_date date,p_quest_type text default 'scheduled')
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid; v_today date; v_due date;
begin
 v_today := (pg_catalog.now() at time zone public.quest_timezone(auth.uid()))::date;
 if auth.uid() is null then raise exception 'Sign-in required'; end if;
 if p_title is null or length(trim(p_title)) not between 1 and 120 then raise exception 'Invalid title'; end if;
 if p_domain not in ('hygiene','home','mental_health','personal_growth','finance','career','relationships','physical_health') then raise exception 'Invalid domain'; end if;
 if p_cadence not in ('once','daily','weekly') then raise exception 'Invalid cadence'; end if;
 if p_quest_type not in ('scheduled','goal') or (p_quest_type='goal' and p_cadence<>'once') then raise exception 'Invalid quest type'; end if;
 if p_date is null or p_date < v_today - 30 or p_date > v_today + 366 then raise exception 'Date out of range'; end if;
 v_due := p_date;
 if p_cadence = 'daily' and p_date < v_today - 2 then
  v_due := v_today - 2;
 end if;
 if p_cadence = 'weekly' then
  v_due := public.quest_week_start(greatest(p_date, v_today));
 end if;
 insert into public.quests(owner_id,title,domain,cadence,scheduled_for,quest_type)
 values(auth.uid(),trim(p_title),p_domain,p_cadence,p_date,p_quest_type) returning id into v_id;
 insert into public.quest_instances(owner_id,quest_id,due_date)
 values(auth.uid(),v_id,v_due);
 return v_id;
end $$;
revoke all on function public.create_scheduled_quest(text,text,text,date,text) from public,anon;
grant execute on function public.create_scheduled_quest(text,text,text,date,text) to authenticated;

create or replace function public.ensure_quest_instance(p_quest_id uuid,p_date date default ((pg_catalog.now() at time zone public.quest_timezone(auth.uid()))::date))
returns uuid language plpgsql security definer set search_path = ''
as $$
declare q public.quests%rowtype; v_id uuid; v_today date; v_date date := p_date;
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
 -- One weekly instance per local week, keyed by its Monday.
 if q.cadence = 'weekly' then
  v_date := public.quest_week_start(p_date);
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(q.id::text,0));
 if q.cadence='once' then
   select id into v_id from public.quest_instances where quest_id=q.id limit 1;
   if found then return v_id; end if;
 end if;
 insert into public.quest_instances(owner_id,quest_id,due_date)
 values(auth.uid(),q.id,v_date)
 on conflict(quest_id,due_date) do update set due_date=excluded.due_date returning id into v_id;
 return v_id;
end $$;
revoke all on function public.ensure_quest_instance(uuid,date) from public,anon;
grant execute on function public.ensure_quest_instance(uuid,date) to authenticated;

-- 5. Completion (0010 and receipt v2 bodies; XP now minted by _award_quest_xp) ---------------
create or replace function public.set_quest_instance_status(p_instance_id uuid,p_action text)
returns text language plpgsql security definer set search_path = ''
as $$
declare inst public.quest_instances%rowtype; q public.quests%rowtype; v_today date;
begin
 v_today := (pg_catalog.now() at time zone public.quest_timezone(auth.uid()))::date;
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if p_action not in ('complete','defer','resume') then raise exception 'Unsupported action'; end if;
 select * into inst from public.quest_instances where id=p_instance_id and owner_id=auth.uid() for update;
 if not found then raise exception 'Instance not found'; end if;
 select * into q from public.quests where id=inst.quest_id and owner_id=auth.uid();
 if not found then raise exception 'Quest not found'; end if;
 if inst.status='completed' then return 'completed'; end if;
 if not q.active then raise exception 'Active quest not found'; end if;
 if p_action='complete' then
   if q.target_amount is not null and inst.current_amount <> q.target_amount then
     raise exception 'Tracked quest has not reached its target';
   end if;
   if q.cadence='daily' and (inst.due_date > v_today or inst.due_date < q.scheduled_for) then
    raise exception 'Future daily quests cannot be completed';
   end if;
   if q.cadence='daily' and inst.due_date < v_today - 2 then
    raise exception 'Daily quests can only be completed for today or the previous 2 days';
   end if;
   if q.cadence='once' and q.quest_type<>'goal' and inst.due_date>v_today then
    raise exception 'Future scheduled quest cannot be completed yet';
   end if;
   if q.cadence='weekly' then
    perform public._check_weekly_window(auth.uid(), q.id, inst.due_date);
   end if;
   update public.quest_instances set status='completed',completed_at=now() where id=inst.id;
   perform public._award_quest_xp(auth.uid(), inst.id);
   if not exists (select 1 from public.xp_ledger where instance_id=inst.id and owner_id=auth.uid()) then
    raise exception 'Quest XP award missing';
   end if;
   insert into public.quest_events(owner_id,instance_id,event_type) values(auth.uid(),inst.id,'completed');
   return 'completed';
 elsif p_action='defer' and inst.status='available' then
   update public.quest_instances set status='deferred' where id=inst.id;
   insert into public.quest_events(owner_id,instance_id,event_type) values(auth.uid(),inst.id,'deferred');
   return 'deferred';
 elsif p_action='resume' and inst.status='deferred' then
   update public.quest_instances set status='available' where id=inst.id;
   insert into public.quest_events(owner_id,instance_id,event_type) values(auth.uid(),inst.id,'resumed');
   return 'available';
 end if;
 return inst.status;
end $$;
revoke all on function public.set_quest_instance_status(uuid,text) from public,anon;
grant execute on function public.set_quest_instance_status(uuid,text) to authenticated;

create or replace function public.set_quest_instance_status_v2(p_instance_id uuid,p_action text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  inst public.quest_instances%rowtype;
  q public.quests%rowtype;
  v_today date := (pg_catalog.now() at time zone public.quest_timezone(auth.uid()))::date;
  v_award jsonb;
  receipt_status text;
  receipt_xp integer := 0;
  receipt_awarded_at timestamptz;
  led public.xp_ledger%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_action is null or p_action not in ('complete','defer','resume') then raise exception 'Unsupported action'; end if;
  select * into inst from public.quest_instances where id=p_instance_id and owner_id=auth.uid() for update;
  if not found then raise exception 'Instance not found'; end if;
  select * into q from public.quests where id=inst.quest_id and owner_id=auth.uid();
  if not found then raise exception 'Quest not found'; end if;
  if inst.status <> 'completed' and not q.active then raise exception 'Active quest not found'; end if;
  if p_action='complete' then
    if inst.status <> 'completed' then
      if q.target_amount is not null and inst.current_amount is distinct from q.target_amount then
        raise exception 'Tracked quest has not reached its target';
      end if;
      if q.cadence='daily' and (inst.due_date > v_today or inst.due_date < q.scheduled_for) then
        raise exception 'Future daily quests cannot be completed';
      end if;
      if q.cadence='daily' and inst.due_date < v_today-2 then
        raise exception 'Daily quests can only be completed for today or the previous 2 days';
      end if;
      if q.cadence='once' and q.quest_type<>'goal' and inst.due_date > v_today then
        raise exception 'Future scheduled quest cannot be completed yet';
      end if;
      if q.cadence='weekly' then
        perform public._check_weekly_window(auth.uid(), q.id, inst.due_date);
      end if;
    end if;
    if inst.status='completed' then
      receipt_status := 'already_awarded';
    else
      update public.quest_instances set status='completed', completed_at=now() where id=inst.id;
      v_award := public._award_quest_xp(auth.uid(), inst.id);
      if (v_award->>'awarded')::boolean then
        receipt_status := 'awarded';
        receipt_xp := (v_award->>'amount')::integer;
      else
        receipt_status := 'already_awarded';
      end if;
      insert into public.quest_events(owner_id,instance_id,event_type) values(auth.uid(),inst.id,'completed');
    end if;
    select * into led from public.xp_ledger where instance_id=inst.id and owner_id=auth.uid();
    receipt_awarded_at := led.awarded_at;
    if receipt_awarded_at is null then receipt_status := 'not_awarded'; end if;
    return jsonb_build_object(
      'schema_version', 1,
      'status', 'completed',
      'quest_instance_id', inst.id,
      'quest_completion_confirmed', true,
      'reward_status', receipt_status,
      'xp_awarded', receipt_xp,
      'reward_confirmed', (receipt_awarded_at is not null),
      'reward_awarded_at', receipt_awarded_at,
      'base_xp', led.base_amount,
      'streak_fire', led.streak_fire,
      'first_of_day', led.first_of_day
    );
  elsif p_action='defer' and inst.status='available' then
    update public.quest_instances set status='deferred' where id=inst.id;
    insert into public.quest_events(owner_id,instance_id,event_type) values(auth.uid(),inst.id,'deferred');
    return jsonb_build_object('schema_version', 1, 'status', 'deferred', 'quest_instance_id', inst.id,
      'quest_completion_confirmed', false, 'reward_status', 'not_awarded', 'xp_awarded', 0,
      'reward_confirmed', false, 'reward_awarded_at', null);
  elsif p_action='resume' and inst.status='deferred' then
    update public.quest_instances set status='available' where id=inst.id;
    insert into public.quest_events(owner_id,instance_id,event_type) values(auth.uid(),inst.id,'resumed');
    return jsonb_build_object('schema_version', 1, 'status', 'available', 'quest_instance_id', inst.id,
      'quest_completion_confirmed', false, 'reward_status', 'not_awarded', 'xp_awarded', 0,
      'reward_confirmed', false, 'reward_awarded_at', null);
  end if;
  if inst.status='completed' then
    select awarded_at into receipt_awarded_at from public.xp_ledger where instance_id=inst.id and owner_id=auth.uid();
  end if;
  return jsonb_build_object('schema_version', 1, 'status', inst.status, 'quest_instance_id', inst.id,
    'quest_completion_confirmed', (inst.status='completed'),
    'reward_status', case when receipt_awarded_at is not null then 'already_awarded' else 'not_awarded' end,
    'xp_awarded', 0, 'reward_confirmed', (receipt_awarded_at is not null), 'reward_awarded_at', receipt_awarded_at);
end $$;
revoke all on function public.set_quest_instance_status_v2(uuid,text) from public,anon;
grant execute on function public.set_quest_instance_status_v2(uuid,text) to authenticated;


-- Flat +1. Replaces the streak-bonus mint. One row per instance, conflict does nothing.
create or replace function public._award_quest_xp(p_owner uuid, p_instance uuid)
returns jsonb language plpgsql volatile security definer set search_path = ''
as $$
declare v_id uuid;
begin
  insert into public.xp_ledger(owner_id, instance_id, amount, base_amount, streak_fire, first_of_day)
  values (p_owner, p_instance, 1, 1, null, null)
  on conflict (instance_id) do nothing
  returning id into v_id;
  return jsonb_build_object(
    'awarded', v_id is not null,
    'amount', case when v_id is null then 0 else 1 end,
    'base', 1,
    'fire', null,
    'first_of_day', null);
end $$;
revoke all on function public._award_quest_xp(uuid, uuid) from public, anon, authenticated, service_role;


-- Per-quest fire in the player's zone. Today counts once that quest is completed today.
-- A gap before yesterday resets the count. Read-only: no XP writes.
create or replace function public.get_quest_streaks()
returns table (quest_id uuid, fire integer, done_today boolean, today date, time_zone text)
language sql stable security definer set search_path = ''
as $$
  with clock as (
    select auth.uid() as owner, public.quest_timezone(auth.uid()) as tz
  ), zoned as (
    select c.owner, c.tz, (pg_catalog.now() at time zone c.tz)::date as today from clock c
  ), daily as (
    select q.id from public.quests q
    where q.owner_id = auth.uid() and q.active and q.cadence = 'daily'
  ), days as (
    select distinct i.quest_id, (i.completed_at at time zone z.tz)::date as day
    from public.quest_instances i
    join daily q on q.id = i.quest_id
    cross join zoned z
    where i.owner_id = auth.uid() and i.status = 'completed' and i.completed_at is not null
      and (i.completed_at at time zone z.tz)::date <= z.today
  ), ranked as (
    select d.quest_id, d.day, row_number() over (partition by d.quest_id order by d.day desc) as n,
      max(d.day) over (partition by d.quest_id) as latest
    from days d
  )
  select q.id,
    count(r.day) filter (where r.latest >= z.today - 1 and r.day = r.latest - (r.n - 1)::integer)::integer,
    coalesce(bool_or(r.day = z.today), false), z.today, z.tz
  from daily q cross join zoned z left join ranked r on r.quest_id = q.id
  group by q.id, z.today, z.tz;
$$;
revoke all on function public.get_quest_streaks() from public, anon;
grant execute on function public.get_quest_streaks() to authenticated;
