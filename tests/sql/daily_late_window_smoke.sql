-- Daily late-logging window. Works after 0007, with or without 0006.
insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000a7');

create temporary table late_ids (
  label text primary key,
  quest_id uuid,
  instance_id uuid
);
grant select, insert on table late_ids to authenticated, service_role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a7', false);
select set_config('request.jwt.claim.role', '', false);
set role authenticated;

do $$
declare
  v_today date := (now() at time zone 'America/Chicago')::date;
  v_user uuid := '00000000-0000-0000-0000-0000000000a7';
  v_quest uuid;
  v_due date;
  v_inst uuid;
  v_xp int;
  v_events int;
  d date;
begin
  v_quest := public.create_scheduled_quest('Old stretch', 'physical_health', 'daily', v_today - 30, 'scheduled');
  select due_date, id into v_due, v_inst from public.quest_instances where quest_id = v_quest;
  if (select scheduled_for from public.quests where id = v_quest) <> v_today - 30 or v_due <> v_today - 2 then
    raise exception 'daily start 30 days ago opened % instead of today-2', v_due;
  end if;
  insert into late_ids values ('habit', v_quest, v_inst);

  perform public.ensure_quest_instance(v_quest, v_today - 1);
  perform public.ensure_quest_instance(v_quest, v_today);
  begin
    perform public.ensure_quest_instance(v_quest, v_today - 3);
    raise exception 'daily instance older than today-2 was opened';
  exception
    when others then
      if sqlerrm <> 'Daily instances cannot be opened before the last 2 days' then
        raise;
      end if;
  end;

  foreach d in array array[v_today - 2, v_today - 1, v_today]
  loop
    select id into v_inst from public.quest_instances where quest_id = v_quest and due_date = d;
    if public.set_quest_instance_status(v_inst, 'complete') <> 'completed' then
      raise exception 'window day % did not complete', d;
    end if;
    if public.set_quest_instance_status(v_inst, 'complete') <> 'completed' then
      raise exception 'second complete on % was not idempotent', d;
    end if;
    select coalesce(sum(amount), 0), count(*) into v_xp, v_events
      from public.xp_ledger l
      join public.quest_events e on e.instance_id = l.instance_id and e.event_type = 'completed'
     where l.instance_id = v_inst;
    if v_xp <> 1 or (select count(*) from public.quest_events where instance_id = v_inst and event_type = 'completed') <> 1 then
      raise exception 'window day % awarded XP % or extra events', d, v_xp;
    end if;
  end loop;

  if (select coalesce(sum(amount), 0) from public.xp_ledger where owner_id = v_user) <> 3 then
    raise exception 'habit created 30 days ago earned more than 3 XP';
  end if;
  raise notice 'PASS today, yesterday, and today-2 earn 1 XP once; 30-day start earns 3';
end
$$;

reset role;
insert into public.quest_instances (id, owner_id, quest_id, due_date)
values (
  '00000000-0000-0000-0000-0000000000a8',
  '00000000-0000-0000-0000-0000000000a7',
  (select quest_id from late_ids where label = 'habit'),
  (now() at time zone 'America/Chicago')::date - 3
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a7', false);
set role authenticated;

do $$
declare
  v_today date := (now() at time zone 'America/Chicago')::date;
  v_quest uuid;
  v_tomorrow uuid;
  v_user uuid := '00000000-0000-0000-0000-0000000000a7';
begin
  select quest_id into v_quest from late_ids where label = 'habit';
  begin
    perform public.set_quest_instance_status('00000000-0000-0000-0000-0000000000a8', 'complete');
    raise exception 'today-3 completion was allowed';
  exception
    when others then
      if sqlerrm <> 'Daily quests can only be completed for today or the previous 2 days' then
        raise;
      end if;
  end;
  if (select status from public.quest_instances where id = '00000000-0000-0000-0000-0000000000a8') <> 'available'
     or exists (select 1 from public.xp_ledger where instance_id = '00000000-0000-0000-0000-0000000000a8') then
    raise exception 'today-3 rejection changed status or awarded XP';
  end if;

  v_tomorrow := public.ensure_quest_instance(v_quest, v_today + 1);
  begin
    perform public.set_quest_instance_status(v_tomorrow, 'complete');
    raise exception 'tomorrow daily completion was allowed';
  exception
    when others then
      if sqlerrm <> 'Future daily quests cannot be completed' then
        raise;
      end if;
  end;
  if exists (select 1 from public.xp_ledger where instance_id = v_tomorrow) then
    raise exception 'tomorrow daily awarded XP';
  end if;
  if (select coalesce(sum(amount), 0) from public.xp_ledger where owner_id = v_user) <> 3 then
    raise exception 'rejected days changed the 3 XP cap';
  end if;
  raise notice 'PASS today-3 and tomorrow earn no XP';
end
$$;

do $$
declare
  v_today date := (now() at time zone 'America/Chicago')::date;
  v_chore uuid;
  v_goal uuid;
  v_inst uuid;
  v_status text;
  v_xp int;
begin
  v_chore := public.create_scheduled_quest('Overdue laundry', 'home', 'once', v_today - 5, 'scheduled');
  select id into v_inst from public.quest_instances where quest_id = v_chore;
  if (select due_date from public.quest_instances where id = v_inst) <> v_today - 5 then
    raise exception 'overdue chore instance was clamped';
  end if;
  v_status := public.set_quest_instance_status(v_inst, 'complete');
  select coalesce(sum(amount), 0) into v_xp from public.xp_ledger where instance_id = v_inst;
  if v_status <> 'completed' or v_xp <> 1 then
    raise exception 'overdue chore did not award XP';
  end if;

  v_goal := public.create_scheduled_quest('Early deadline', 'career', 'once', v_today + 10, 'goal');
  select id into v_inst from public.quest_instances where quest_id = v_goal;
  v_status := public.set_quest_instance_status(v_inst, 'complete');
  select coalesce(sum(amount), 0) into v_xp from public.xp_ledger where instance_id = v_inst;
  if v_status <> 'completed' or v_xp <> 1 then
    raise exception 'early goal did not award XP';
  end if;
  raise notice 'PASS overdue chore and early goal still award XP';
end
$$;

reset role;
insert into late_ids (label, quest_id, instance_id)
select 'today', quest_id, id
  from public.quest_instances
 where quest_id = (select quest_id from late_ids where label = 'habit')
   and due_date = (now() at time zone 'America/Chicago')::date;

select set_config('request.jwt.claim.role', 'service_role', false);
select set_config('request.jwt.claim.sub', '', false);
set role service_role;
do $$
begin
  if public.set_quest_instance_status_as_user(
    '00000000-0000-0000-0000-0000000000a7',
    (select instance_id from late_ids where label = 'today'),
    'complete'
  ) <> 'completed' then
    raise exception 'as_user replay was not idempotent';
  end if;
  begin
    perform public.set_quest_instance_status_as_user(
      '00000000-0000-0000-0000-0000000000a7',
      '00000000-0000-0000-0000-0000000000a8',
      'complete'
    );
    raise exception 'as_user completed a daily instance older than today-2';
  exception
    when others then
      if sqlerrm <> 'Daily quests can only be completed for today or the previous 2 days' then
        raise;
      end if;
  end;
end
$$;

reset role;
do $$
declare v_xp int;
begin
  select coalesce(sum(amount), 0) into v_xp
    from public.xp_ledger
   where instance_id = (select instance_id from late_ids where label = 'today');
  if v_xp <> 1 then
    raise exception 'as_user replay changed today XP to %', v_xp;
  end if;
  if exists (select 1 from public.xp_ledger where instance_id = '00000000-0000-0000-0000-0000000000a8') then
    raise exception 'as_user today-3 awarded XP';
  end if;
  raise notice 'PASS as_user completion uses the daily window';
end
$$;

reset role;
do $$
declare
  v_today date := (now() at time zone 'America/Chicago')::date;
  v_quest uuid;
  v_inst uuid;
  v_xp int;
begin
  if to_regprocedure('public.archive_quest(uuid)') is null then
    raise notice 'PASS archive rules skipped; 0006 is not installed';
    return;
  end if;

  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a7', false);
  perform set_config('request.jwt.claim.role', '', false);
  set local role authenticated;

  v_quest := public.create_scheduled_quest('Archive after complete', 'home', 'once', v_today, 'goal');
  select id into v_inst from public.quest_instances where quest_id = v_quest;
  perform public.set_quest_instance_status(v_inst, 'complete');
  perform public.archive_quest(v_quest);
  if public.set_quest_instance_status(v_inst, 'complete') <> 'completed' then
    raise exception 'archived completed quest lost idempotent return';
  end if;
  select coalesce(sum(amount), 0) into v_xp from public.xp_ledger where instance_id = v_inst;
  if v_xp <> 1 then
    raise exception 'archived replay changed XP to %', v_xp;
  end if;

  v_quest := public.create_scheduled_quest('Archive before complete', 'home', 'daily', v_today, 'scheduled');
  select id into v_inst from public.quest_instances where quest_id = v_quest;
  perform public.archive_quest(v_quest);
  begin
    perform public.set_quest_instance_status(v_inst, 'complete');
    raise exception 'archived open daily was completed';
  exception
    when others then
      if sqlerrm <> 'Active quest not found' then
        raise;
      end if;
  end;
  if exists (select 1 from public.xp_ledger where instance_id = v_inst) then
    raise exception 'archived open daily awarded XP';
  end if;
  raise notice 'PASS 0006 idempotent return and active check survive 0007';
end
$$;
