-- Quest & streak rules (founder-approved, t672u). TEST-ONLY candidate (njqwwimzrsunheehnnnt).
-- Reverse with supabase/rollbacks/202610310001_quest_streaks_weekly_down.sql.
--
-- What changes:
--   * quests.cadence also allows 'weekly'. A weekly quest has one instance per local week,
--     keyed by that week's Monday (due_date). It appears at a seeded time between Monday 00:00
--     and Thursday 12:00 local (public.quest_weekly_appears_at) and can be completed from then
--     until Sunday 23:59 local. The server enforces that window.
--   * Streak ("fire") bonus, computed here at award time, never by the client:
--       F = consecutive local days ending yesterday with at least one XP ledger row.
--       First completion of a local day: base XP, no bonus (it keeps the streak).
--       Every other completion that day: floor(base * (10 + F) / 10). Integer math, no cap.
--     A per-owner advisory lock makes "first of the day" atomic, so two taps (or two
--     quests completed at once) can never both count as first.
--   * xp_ledger.amount may now exceed 1 (bonus); base_amount, streak_fire and first_of_day
--     record how each award was computed. Every real completion is still base +1 XP, still
--     one ledger row per quest instance (unique instance_id), still self-report only.
--   * Local day: the profile's time zone if a valid one is ever stored (profiles has no such
--     column today), otherwise America/Chicago, the same boundary as every completion window.
--
-- Unchanged: RLS and grants on every table; the Crypt XP cap (counts ledger rows, i.e. quests);
-- Ashen Hood unlock (10 ledger rows); daily/once/goal completion windows; tracked-progress guard;
-- the *_as_user wrappers (they call the functions redefined below).

-- 1. Schema (additive) ---------------------------------------------------------------------
alter table public.quests drop constraint if exists quests_cadence_check;
alter table public.quests add constraint quests_cadence_check check (cadence in ('once','daily','weekly'));

alter table public.xp_ledger drop constraint if exists xp_ledger_amount_check;
alter table public.xp_ledger add constraint xp_ledger_amount_check check (amount between 1 and 1000000);
alter table public.xp_ledger
  add column if not exists base_amount integer check (base_amount is null or base_amount = 1),
  add column if not exists streak_fire integer check (streak_fire is null or streak_fire >= 0),
  add column if not exists first_of_day boolean;

-- 2. Pure helpers ---------------------------------------------------------------------------
create or replace function public.quest_fnv1a(p_text text)
returns bigint language plpgsql immutable strict set search_path = ''
as $$
declare b bytea := pg_catalog.convert_to(p_text, 'UTF8'); h bigint := 2166136261; i integer;
begin
  for i in 0 .. pg_catalog.length(b) - 1 loop
    h := ((h # pg_catalog.get_byte(b, i)) * 16777619) % 4294967296;
  end loop;
  return h;
end $$;

-- floor(base * (1 + 0.10 * F)) in integers; the first completion of a day gets no bonus.
create or replace function public.quest_streak_xp(p_base integer, p_fire integer, p_first boolean)
returns integer language sql immutable strict set search_path = ''
as $$ select case when p_first then p_base else ((p_base::bigint * (10 + greatest(p_fire, 0))) / 10)::integer end $$;

create or replace function public.quest_week_start(p_day date)
returns date language sql immutable strict set search_path = ''
as $$ select p_day - (pg_catalog.date_part('isodow', p_day)::integer - 1) $$;

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

-- Local wall time Monday 00:00 + seeded minutes in [0, 5040) = up to Thursday 11:59.
create or replace function public.quest_weekly_appears_at(p_owner uuid, p_quest uuid, p_week date, p_tz text)
returns timestamptz language sql stable strict set search_path = ''
as $$
  select ((p_week::timestamp
    + pg_catalog.make_interval(mins => (public.quest_fnv1a(p_owner::text || ':' || p_quest::text || ':' || p_week::text) % 5040)::integer))
    at time zone p_tz)
$$;

-- 3. Streak ---------------------------------------------------------------------------------
create or replace function public.quest_has_completion_on(p_owner uuid, p_day date, p_tz text)
returns boolean language sql stable set search_path = ''
as $$
  select exists (
    select 1 from public.xp_ledger
    where owner_id = p_owner
      and awarded_at >= (p_day::timestamp at time zone p_tz)
      and awarded_at < ((p_day + 1)::timestamp at time zone p_tz))
$$;

create or replace function public.quest_streak_fire(p_owner uuid, p_today date, p_tz text)
returns integer language plpgsql stable set search_path = ''
as $$
declare d date := p_today - 1; n integer := 0;
begin
  while public.quest_has_completion_on(p_owner, d, p_tz) loop
    n := n + 1;
    d := d - 1;
  end loop;
  return n;
end $$;

-- The only place quest XP is minted from now on. Internal: not executable by clients.
create or replace function public._award_quest_xp(p_owner uuid, p_instance uuid)
returns jsonb language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_tz text := public.quest_timezone(p_owner);
  v_today date;
  v_first boolean;
  v_fire integer;
  v_amount integer;
  v_id uuid;
begin
  -- Serialize this owner's awards so only one can be the first of the day.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('quest-streak:' || p_owner::text, 0));
  v_today := (pg_catalog.now() at time zone v_tz)::date;
  v_first := not public.quest_has_completion_on(p_owner, v_today, v_tz);
  v_fire := public.quest_streak_fire(p_owner, v_today, v_tz);
  v_amount := public.quest_streak_xp(1, v_fire, v_first);
  insert into public.xp_ledger(owner_id, instance_id, amount, base_amount, streak_fire, first_of_day)
  values (p_owner, p_instance, v_amount, 1, v_fire, v_first)
  on conflict (instance_id) do nothing
  returning id into v_id;
  return jsonb_build_object('awarded', v_id is not null, 'amount', case when v_id is null then 0 else v_amount end,
    'base', 1, 'fire', v_fire, 'first_of_day', v_first);
end $$;
revoke all on function public._award_quest_xp(uuid, uuid) from public, anon, authenticated, service_role;

-- Board badge: today's fire for the signed-in user.
create or replace function public.get_quest_streak()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare v_owner uuid := auth.uid(); v_tz text; v_today date;
begin
  if v_owner is null then raise exception 'Authentication required'; end if;
  v_tz := public.quest_timezone(v_owner);
  v_today := (pg_catalog.now() at time zone v_tz)::date;
  return jsonb_build_object(
    'fire', public.quest_streak_fire(v_owner, v_today, v_tz),
    'done_today', public.quest_has_completion_on(v_owner, v_today, v_tz),
    'today', v_today,
    'time_zone', v_tz);
end $$;
revoke all on function public.get_quest_streak() from public, anon;
grant execute on function public.get_quest_streak() to authenticated;

-- Weekly window check shared by both completion RPCs. Raises when outside the window.
create or replace function public._check_weekly_window(p_owner uuid, p_quest uuid, p_due date)
returns void language plpgsql stable set search_path = ''
as $$
declare v_tz text := public.quest_timezone(p_owner); v_week date;
begin
  v_week := public.quest_week_start((pg_catalog.now() at time zone v_tz)::date);
  if p_due <> v_week then
    raise exception 'Weekly quests can only be completed during their own week';
  end if;
  if pg_catalog.now() < public.quest_weekly_appears_at(p_owner, p_quest, p_due, v_tz) then
    raise exception 'This weekly quest is not on your board yet';
  end if;
end $$;
revoke all on function public._check_weekly_window(uuid, uuid, date) from public, anon, authenticated, service_role;

-- 4. Creation and instances (0007 bodies + weekly) -------------------------------------------
create or replace function public.create_scheduled_quest(p_title text,p_domain text,p_cadence text,p_date date,p_quest_type text default 'scheduled')
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid; v_today date; v_due date;
begin
 v_today := (now() at time zone 'America/Chicago')::date;
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

create or replace function public.ensure_quest_instance(p_quest_id uuid,p_date date default ((now() at time zone 'America/Chicago')::date))
returns uuid language plpgsql security definer set search_path = ''
as $$
declare q public.quests%rowtype; v_id uuid; v_today date; v_date date := p_date;
begin
 v_today := (now() at time zone 'America/Chicago')::date;
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
 v_today := (now() at time zone 'America/Chicago')::date;
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
  v_today date := (now() at time zone 'America/Chicago')::date;
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

revoke all on function public.quest_fnv1a(text), public.quest_streak_xp(integer,integer,boolean), public.quest_week_start(date),
  public.quest_timezone(uuid), public.quest_weekly_appears_at(uuid,uuid,date,text), public.quest_has_completion_on(uuid,date,text),
  public.quest_streak_fire(uuid,date,text) from public, anon, authenticated;

notify pgrst, 'reload schema';
