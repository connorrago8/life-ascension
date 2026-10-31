-- Rollback for 202610310001_quest_streaks_weekly.sql. TEST project only (njqwwimzrsunheehnnnt).
-- Restores the previous function bodies verbatim (0007 create/ensure, 0010 status, 0027 receipt v2)
-- and the "every ledger row is exactly +1" schema.
-- Data handling (destructive for bonus data, which is why this is a manual, test-only step):
--   * streak-bonus ledger rows are reset to amount 1 (lifetime XP drops by the bonus);
--   * weekly quests are archived (active=false) and switched to cadence 'once' so the old
--     cadence check can be restored; their history and XP rows are kept.
begin;

update public.xp_ledger set amount = 1 where amount <> 1;
update public.quests set active = false, cadence = 'once' where cadence = 'weekly';

create or replace function public.create_scheduled_quest(p_title text,p_domain text,p_cadence text,p_date date,p_quest_type text default 'scheduled')
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid; v_today date; v_due date;
begin
 v_today := (now() at time zone 'America/Chicago')::date;
 if auth.uid() is null then raise exception 'Sign-in required'; end if;
 if p_title is null or length(trim(p_title)) not between 1 and 120 then raise exception 'Invalid title'; end if;
 if p_domain not in ('hygiene','home','mental_health','personal_growth','finance','career','relationships','physical_health') then raise exception 'Invalid domain'; end if;
 if p_cadence not in ('once','daily') then raise exception 'Invalid cadence'; end if;
 if p_quest_type not in ('scheduled','goal') or (p_quest_type='goal' and p_cadence<>'once') then raise exception 'Invalid quest type'; end if;
 if p_date is null or p_date < v_today - 30 or p_date > v_today + 366 then raise exception 'Date out of range'; end if;
 v_due := p_date;
 if p_cadence = 'daily' and p_date < v_today - 2 then
  v_due := v_today - 2;
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
declare q public.quests%rowtype; v_id uuid; v_today date;
begin
 v_today := (now() at time zone 'America/Chicago')::date;
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if p_date is null or p_date < v_today-30 or p_date > v_today+1 then raise exception 'Date outside allowed window'; end if;
 select * into q from public.quests where id=p_quest_id and owner_id=auth.uid() and active;
 if not found then raise exception 'Quest not found'; end if;
 if q.scheduled_for is not null and p_date < q.scheduled_for then raise exception 'Quest not yet scheduled'; end if;
 if q.cadence = 'daily' and p_date < v_today - 2 then
  raise exception 'Daily instances cannot be opened before the last 2 days';
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(q.id::text,0));
 if q.cadence='once' then
   select id into v_id from public.quest_instances where quest_id=q.id limit 1;
   if found then return v_id; end if;
 end if;
 insert into public.quest_instances(owner_id,quest_id,due_date)
 values(auth.uid(),q.id,p_date)
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
 -- Same order as 0006: an already completed instance stays completed, including after archive.
 if inst.status='completed' then return 'completed'; end if;
 if not q.active then raise exception 'Active quest not found'; end if;
 if p_action='complete' then
   -- Tracked quests must reach their target before any completion path awards XP.
   -- This also protects service-role API-key wrappers that call this RPC.
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
   update public.quest_instances set status='completed',completed_at=now() where id=inst.id;
   insert into public.xp_ledger(owner_id,instance_id,amount) values(auth.uid(),inst.id,1) on conflict(instance_id) do nothing;
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
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  inst public.quest_instances%rowtype;
  q public.quests%rowtype;
  v_today date := (now() at time zone 'America/Chicago')::date;
  ledger_entry_id uuid;
  receipt_status text;
  receipt_xp integer := 0;
  receipt_awarded_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_action is null or p_action not in ('complete','defer','resume') then
    raise exception 'Unsupported action';
  end if;

  select * into inst
  from public.quest_instances
  where id=p_instance_id and owner_id=auth.uid()
  for update;

  if not found then
    raise exception 'Instance not found';
  end if;

  -- Mirror archived quest and due-date enforcement from the effective 0007 RPC.
  select * into q from public.quests where id=inst.quest_id and owner_id=auth.uid();
  if not found then raise exception 'Quest not found'; end if;
  if inst.status <> 'completed' and not q.active then
    raise exception 'Active quest not found';
  end if;
  if p_action='complete' then
    if inst.status <> 'completed' then
      -- Parity with the tracked-progress completion guard when migration 0008
      -- is present. JSON conversion keeps this standalone receipt migration
      -- compatible with the legacy schema (which has no progress columns).
      -- A missing current amount on a tracked quest fails closed.
      if (to_jsonb(q)->>'target_amount') is not null
         and (to_jsonb(inst)->>'current_amount')::integer is distinct from
             (to_jsonb(q)->>'target_amount')::integer then
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
    end if;
    if inst.status='completed' then
      receipt_status := 'already_awarded';
    else
      update public.quest_instances
      set status='completed', completed_at=now()
      where id=inst.id;

      insert into public.xp_ledger(owner_id,instance_id,amount)
      values(auth.uid(),inst.id,1)
      on conflict(instance_id) do nothing
      returning id into ledger_entry_id;

      if ledger_entry_id is not null then
        receipt_status := 'awarded';
        receipt_xp := 1;
      else
        receipt_status := 'already_awarded';
      end if;

      insert into public.quest_events(owner_id,instance_id,event_type)
      values(auth.uid(),inst.id,'completed');
    end if;

    -- The initial RPC response may be lost after COMMIT. A retry must report
    -- durable ledger evidence, not just XP newly minted by this invocation.
    select awarded_at into receipt_awarded_at
    from public.xp_ledger
    where instance_id=inst.id and owner_id=auth.uid();
    if receipt_awarded_at is null then
      -- A completed instance without a ledger row is an anomaly, not proof of XP.
      receipt_status := 'not_awarded';
    end if;
    return jsonb_build_object(
      'schema_version', 1,
      'status', 'completed',
      'quest_instance_id', inst.id,
      'quest_completion_confirmed', true,
      'reward_status', receipt_status,
      'xp_awarded', receipt_xp,
      'reward_confirmed', (receipt_awarded_at is not null),
      'reward_awarded_at', receipt_awarded_at
    );
  elsif p_action='defer' and inst.status='available' then
    update public.quest_instances set status='deferred' where id=inst.id;
    insert into public.quest_events(owner_id,instance_id,event_type)
    values(auth.uid(),inst.id,'deferred');
    return jsonb_build_object(
      'schema_version', 1,
      'status', 'deferred',
      'quest_instance_id', inst.id,
      'quest_completion_confirmed', false,
      'reward_status', 'not_awarded',
      'xp_awarded', 0,
      'reward_confirmed', false,
      'reward_awarded_at', null
    );
  elsif p_action='resume' and inst.status='deferred' then
    update public.quest_instances set status='available' where id=inst.id;
    insert into public.quest_events(owner_id,instance_id,event_type)
    values(auth.uid(),inst.id,'resumed');
    return jsonb_build_object(
      'schema_version', 1,
      'status', 'available',
      'quest_instance_id', inst.id,
      'quest_completion_confirmed', false,
      'reward_status', 'not_awarded',
      'xp_awarded', 0,
      'reward_confirmed', false,
      'reward_awarded_at', null
    );
  end if;

  -- Invalid/no-op transitions never mint XP. If a completed state is read,
  -- only the existing ledger row can substantiate a reward confirmation.
  if inst.status='completed' then
    select awarded_at into receipt_awarded_at
    from public.xp_ledger
    where instance_id=inst.id and owner_id=auth.uid();
  end if;
  return jsonb_build_object(
    'schema_version', 1,
    'status', inst.status,
    'quest_instance_id', inst.id,
    'quest_completion_confirmed', (inst.status='completed'),
    'reward_status', case when receipt_awarded_at is not null then 'already_awarded' else 'not_awarded' end,
    'xp_awarded', 0,
    'reward_confirmed', (receipt_awarded_at is not null),
    'reward_awarded_at', receipt_awarded_at
  );
end;
$$;

revoke all on function public.set_quest_instance_status_v2(uuid,text) from public,anon;
grant execute on function public.set_quest_instance_status_v2(uuid,text) to authenticated;

drop function if exists public.get_quest_streak();
drop function if exists public._award_quest_xp(uuid, uuid);
drop function if exists public._check_weekly_window(uuid, uuid, date);
drop function if exists public.quest_streak_fire(uuid, date, text);
drop function if exists public.quest_has_completion_on(uuid, date, text);
drop function if exists public.quest_weekly_appears_at(uuid, uuid, date, text);
drop function if exists public.quest_timezone(uuid);
drop function if exists public.quest_week_start(date);
drop function if exists public.quest_streak_xp(integer, integer, boolean);
drop function if exists public.quest_fnv1a(text);

alter table public.xp_ledger drop column if exists base_amount, drop column if exists streak_fire, drop column if exists first_of_day;
alter table public.xp_ledger drop constraint if exists xp_ledger_amount_check;
alter table public.xp_ledger add constraint xp_ledger_amount_check check (amount = 1);
alter table public.quests drop constraint if exists quests_cadence_check;
alter table public.quests add constraint quests_cadence_check check (cadence in ('once','daily'));

commit;
notify pgrst, 'reload schema';
