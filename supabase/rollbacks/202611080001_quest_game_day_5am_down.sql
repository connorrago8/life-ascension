-- Reverse 202611080001_quest_game_day_5am.sql. Restores midnight local-day windows.
-- Does not rewrite xp_ledger or quest history. Does not narrow xp_ledger.base_amount
-- (202611060001_quest_base_xp10_down.sql owns that, and narrowing would reject base-10 rows).
-- An Izzy delegation of _award_quest_xp is left in place; only the personal helper's clock
-- returns to midnight. The repo-chain delegate (no Izzy body) returns to the inline base-1 minter.

begin;

create or replace function public.quest_has_completion_on(p_owner uuid, p_day date, p_tz text)
returns boolean language sql stable set search_path = ''
as $$
  select exists (
    select 1 from public.xp_ledger
    where owner_id = p_owner
      and awarded_at >= (p_day::timestamp at time zone p_tz)
      and awarded_at < ((p_day + 1)::timestamp at time zone p_tz))
$$;

create or replace function public.quest_weekly_appears_at(p_owner uuid, p_quest uuid, p_week date, p_tz text)
returns timestamptz language sql stable strict set search_path = ''
as $$
  select ((p_week::timestamp
    + pg_catalog.make_interval(mins => (public.quest_fnv1a(p_owner::text || ':' || p_quest::text || ':' || p_week::text) % 5040)::integer))
    at time zone p_tz)
$$;

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
revoke all on function public._award_personal_quest_xp(uuid, uuid) from public, anon, authenticated, service_role;

do $$
declare body text := pg_catalog.pg_get_functiondef('public._award_quest_xp(uuid,uuid)'::regprocedure);
begin
  if position('izzy_approved_assignments' in body) > 0 then
    return;
  end if;
  execute $fn$
create or replace function public._award_quest_xp(p_owner uuid, p_instance uuid)
returns jsonb language plpgsql volatile security definer set search_path = ''
as $award$
declare
  v_tz text := public.quest_timezone(p_owner);
  v_today date;
  v_first boolean;
  v_fire integer;
  v_amount integer;
  v_id uuid;
begin
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
end
$award$
$fn$;
  execute 'drop function if exists public._award_personal_quest_xp(uuid, uuid)';
end $$;
revoke all on function public._award_quest_xp(uuid, uuid) from public, anon, authenticated, service_role;

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

create or replace function public.log_quest_progress(
  p_instance_id uuid,
  p_request_id uuid,
  p_delta integer
)
returns table(current_amount integer, status text, completed_now boolean)
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_inst public.quest_instances%rowtype;
  v_quest public.quests%rowtype;
  v_old public.quest_progress_operations%rowtype;
  v_next integer;
  v_status text;
  v_today date;
  v_lock bigint;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_instance_id is null or p_request_id is null or p_delta is null or p_delta = 0 then
    raise exception 'Invalid progress request';
  end if;
  v_lock := pg_catalog.hashtextextended(v_user::text || ':' || p_request_id::text, 0);
  perform pg_catalog.pg_advisory_xact_lock(v_lock);
  select * into v_quest from public.quests
    where id = (select quest_id from public.quest_instances
                where id=p_instance_id and owner_id=v_user)
      and owner_id=v_user for update;
  if not found then raise exception 'Quest not found'; end if;
  select * into v_inst from public.quest_instances
    where id = p_instance_id and owner_id = v_user for update;
  if not found then raise exception 'Instance not found'; end if;
  select * into v_old from public.quest_progress_operations
    where owner_id = v_user and request_id = p_request_id;
  if found then
    if v_old.instance_id <> p_instance_id or v_old.delta <> p_delta then
      raise exception 'Request ID reused with different payload';
    end if;
    return query select v_old.resulting_amount, v_old.resulting_status, false;
    return;
  end if;
  if not v_quest.active then raise exception 'Active quest not found'; end if;
  if v_quest.target_amount is null then raise exception 'Quest does not track partial progress'; end if;
  if v_inst.status <> 'available' then raise exception 'Instance is not available for progress'; end if;
  if v_inst.current_amount > v_quest.target_amount then
    raise exception 'Stored progress exceeds target; configuration requires repair';
  end if;
  v_today := (now() at time zone 'America/Chicago')::date;
  if v_quest.cadence = 'daily' and (v_inst.due_date > v_today or v_inst.due_date < v_today - 2
      or (v_quest.scheduled_for is not null and v_inst.due_date < v_quest.scheduled_for)) then
    raise exception 'Daily progress is outside the completion window';
  end if;
  if v_quest.cadence = 'once' and v_quest.quest_type <> 'goal' and v_inst.due_date > v_today then
    raise exception 'Future scheduled quest cannot log progress yet';
  end if;
  if p_delta < 0
     and p_delta <> -v_quest.progress_increment
     and p_delta <> -v_inst.current_amount then
    raise exception 'Undo must reverse one increment or clear current progress';
  end if;
  if p_delta > v_quest.target_amount then raise exception 'Progress amount exceeds target'; end if;
  if p_delta < 0 and not exists (
      select 1 from public.quest_progress_operations
      where instance_id=v_inst.id and owner_id=v_user and delta>0
  ) then raise exception 'No progress operation to undo'; end if;
  v_next := v_inst.current_amount + p_delta;
  if v_next < 0 or v_next > v_quest.target_amount then
    raise exception 'Progress would exceed allowed range';
  end if;
  update public.quest_instances
    set current_amount = v_next, progress_updated_at = now()
    where id = v_inst.id;
  v_status := 'available';
  if v_next = v_quest.target_amount then
    v_status := public.set_quest_instance_status(v_inst.id, 'complete');
  end if;
  insert into public.quest_progress_operations
    (owner_id, instance_id, request_id, delta, resulting_amount, resulting_status)
    values (v_user, v_inst.id, p_request_id, p_delta, v_next, v_status);
  return query select v_next, v_status, (v_status = 'completed');
end
$$;
revoke all on function public.log_quest_progress(uuid,uuid,integer) from public, anon;
grant execute on function public.log_quest_progress(uuid,uuid,integer) to authenticated;

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

drop function if exists public.quest_today();
drop function if exists public.quest_game_day(timestamptz, text);

notify pgrst, 'reload schema';

commit;
