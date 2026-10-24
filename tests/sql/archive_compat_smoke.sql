-- Compatibility cases for migration 0006, after 0007 has replaced set_quest_instance_status.
-- The final function returns completed before the active check, and a deferred daily
-- whose start moved forward still raises the future-daily error.

insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000f1');

create temporary table arch_ids (
  label text primary key,
  quest_id uuid,
  instance_id uuid
);
grant select, insert on table arch_ids to authenticated, service_role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f1', false);
select set_config('request.jwt.claim.role', '', false);
set role authenticated;

do $$
declare
  v_today date := (now() at time zone 'America/Chicago')::date;
  v_quest uuid;
  v_inst uuid;
  v_xp bigint;
begin
  v_quest := public.create_scheduled_quest('Archive open goal', 'home', 'once', v_today, 'goal');
  select id into v_inst from public.quest_instances where quest_id = v_quest;
  perform public.archive_quest(v_quest);
  begin
    perform public.set_quest_instance_status(v_inst, 'complete');
    raise exception 'archived quest completion was allowed';
  exception
    when others then
      if sqlerrm <> 'Active quest not found' then
        raise;
      end if;
  end;
  select coalesce(sum(amount), 0) into v_xp from public.xp_ledger where instance_id = v_inst;
  if v_xp <> 0 or (select status from public.quest_instances where id = v_inst) <> 'available' then
    raise exception 'archived completion changed XP or status';
  end if;
  insert into arch_ids values ('open_archived', v_quest, v_inst);
  raise notice 'PASS archived quest cannot be completed and earns no XP';
end
$$;

do $$
declare
  v_today date := (now() at time zone 'America/Chicago')::date;
  v_quest uuid;
  v_inst uuid;
  v_xp bigint;
begin
  v_quest := public.create_scheduled_quest('Archive done goal', 'career', 'once', v_today, 'goal');
  select id into v_inst from public.quest_instances where quest_id = v_quest;
  if public.set_quest_instance_status(v_inst, 'complete') <> 'completed' then
    raise exception 'pre-archive completion failed';
  end if;
  perform public.archive_quest(v_quest);
  select coalesce(sum(amount), 0) into v_xp from public.xp_ledger where instance_id = v_inst;
  if v_xp <> 1 or (select status from public.quest_instances where id = v_inst) <> 'completed'
     or (select active from public.quests where id = v_quest) then
    raise exception 'archive dropped the completion or XP';
  end if;
  if public.set_quest_instance_status(v_inst, 'complete') <> 'completed' then
    raise exception 'archived completed quest lost idempotent return';
  end if;
  if (select coalesce(sum(amount), 0) from public.xp_ledger where instance_id = v_inst) <> 1 then
    raise exception 'archived retry changed XP';
  end if;
  insert into arch_ids values ('done_archived', v_quest, v_inst);
  raise notice 'PASS archive keeps the completion and XP; retry does not add XP';
end
$$;

do $$
declare
  v_today date := (now() at time zone 'America/Chicago')::date;
  v_past date := v_today - 2;
  v_future date := v_today + 7;
  v_quest uuid;
  v_past_inst uuid;
  v_today_inst uuid;
  v_xp bigint;
begin
  v_quest := public.create_scheduled_quest('Morning stretch', 'physical_health', 'daily', v_past, 'scheduled');
  select id into v_past_inst from public.quest_instances where quest_id = v_quest and due_date = v_past;
  if public.set_quest_instance_status(v_past_inst, 'complete') <> 'completed' then
    raise exception 'past daily completion failed';
  end if;
  v_today_inst := public.ensure_quest_instance(v_quest, v_today);
  perform public.reschedule_quest(v_quest, v_future);
  if (select scheduled_for from public.quests where id = v_quest) <> v_future then
    raise exception 'daily start date did not move';
  end if;
  if (select status from public.quest_instances where id = v_past_inst) <> 'completed'
     or (select due_date from public.quest_instances where id = v_past_inst) <> v_past then
    raise exception 'reschedule rewrote a past completion';
  end if;
  if (select status from public.quest_instances where id = v_today_inst) <> 'deferred' then
    raise exception 'today''s open daily instance was not deferred';
  end if;
  select coalesce(sum(amount), 0) into v_xp from public.xp_ledger where owner_id = '00000000-0000-0000-0000-0000000000f1' and instance_id in (v_past_inst, v_today_inst);
  if v_xp <> 1 then
    raise exception 'daily reschedule XP is %, expected 1', v_xp;
  end if;
  begin
    perform public.set_quest_instance_status(v_today_inst, 'complete');
    raise exception 'deferred future-start daily completed';
  exception
    when others then
      if sqlerrm <> 'Future daily quests cannot be completed' then
        raise;
      end if;
  end;
  if (select coalesce(sum(amount), 0) from public.xp_ledger where instance_id = v_today_inst) <> 0 then
    raise exception 'future-start daily awarded XP';
  end if;
  raise notice 'PASS daily habit reschedules after completions and defers today with no XP';
end
$$;

do $$
declare
  v_today date := (now() at time zone 'America/Chicago')::date;
  v_dow int := extract(dow from v_today)::int;
  v_add int := (4 - v_dow + 7) % 7;
  v_thu date;
  v_quest uuid;
  v_inst uuid;
begin
  if v_add = 0 then
    v_add := 7;
  end if;
  v_thu := v_today + v_add;
  v_quest := public.create_scheduled_quest('Take out recycling', 'home', 'once', v_thu, 'scheduled');
  select id into v_inst from public.quest_instances where quest_id = v_quest;
  begin
    perform public.reschedule_quest(v_quest, v_today);
    raise exception 'scheduled chore moved earlier';
  exception
    when others then
      if sqlerrm <> 'Scheduled chores cannot be moved earlier' then
        raise;
      end if;
  end;
  if (select due_date from public.quest_instances where id = v_inst) <> v_thu
     or (select scheduled_for from public.quests where id = v_quest) <> v_thu then
    raise exception 'rejected reschedule still moved the chore';
  end if;
  begin
    perform public.set_quest_instance_status(v_inst, 'complete');
    raise exception 'future chore completed after rejected reschedule';
  exception
    when others then
      if sqlerrm <> 'Future scheduled quest cannot be completed yet' then
        raise;
      end if;
  end;
  if exists (select 1 from public.xp_ledger where instance_id = v_inst) then
    raise exception 'future chore awarded XP';
  end if;
  raise notice 'PASS scheduled chore cannot be moved earlier to today and completed';
end
$$;

do $$
declare v_quest uuid;
begin
  v_quest := public.create_scheduled_quest('Old title', 'personal_growth', 'once', (now() at time zone 'America/Chicago')::date, 'goal');
  perform public.rename_quest(v_quest, '  New title  ');
  if (select title from public.quests where id = v_quest) <> 'New title' then
    raise exception 'rename did not store the trimmed title';
  end if;
  perform public.archive_quest(v_quest);
  begin
    perform public.rename_quest(v_quest, 'After archive');
    raise exception 'archived quest was renamed';
  exception
    when others then
      if sqlerrm <> 'Active quest not found' then
        raise;
      end if;
  end;
  raise notice 'PASS rename updates an active quest';
end
$$;

reset role;
select set_config('request.jwt.claim.role', 'service_role', false);
select set_config('request.jwt.claim.sub', '', false);
set role service_role;

do $$
declare
  v_today date := (now() at time zone 'America/Chicago')::date;
  v_user uuid := '00000000-0000-0000-0000-0000000000f1';
  v_open uuid;
  v_quest uuid;
  v_inst uuid;
  v_after bigint;
begin
  select instance_id into v_open from arch_ids where label = 'open_archived';
  begin
    perform public.set_quest_instance_status_as_user(v_user, v_open, 'complete');
    raise exception 'as_user wrapper completed an archived quest';
  exception
    when others then
      if sqlerrm <> 'Active quest not found' then
        raise;
      end if;
  end;
  v_quest := public.create_scheduled_quest_as_user(v_user, 'Wrapper goal', 'career', 'once', v_today, 'goal');
  select id into v_inst from public.quest_instances where quest_id = v_quest;
  if public.set_quest_instance_status_as_user(v_user, v_inst, 'complete') <> 'completed' then
    raise exception 'as_user wrapper did not complete an active quest';
  end if;
  if public.set_quest_instance_status_as_user(v_user, v_inst, 'complete') <> 'completed' then
    raise exception 'as_user second completion was not idempotent';
  end if;
  select public.get_lifetime_xp_as_user(v_user) into v_after;
  if v_after <> 3 then
    raise exception 'lifetime XP missing the wrapper award (% )', v_after;
  end if;
  insert into arch_ids values ('wrapper_goal', v_quest, v_inst);
  raise notice 'PASS as_user wrappers still reach set_quest_instance_status after 0006';
end
$$;

reset role;
do $$
declare v_open int;
declare v_done int;
declare v_wrap int;
begin
  select coalesce(sum(amount), 0) into v_open from public.xp_ledger where instance_id = (select instance_id from arch_ids where label = 'open_archived');
  select coalesce(sum(amount), 0) into v_done from public.xp_ledger where instance_id = (select instance_id from arch_ids where label = 'done_archived');
  select coalesce(sum(amount), 0) into v_wrap from public.xp_ledger where instance_id = (select instance_id from arch_ids where label = 'wrapper_goal');
  if v_open <> 0 or v_done <> 1 or v_wrap <> 1 then
    raise exception 'wrapper XP ledger mismatch (open %, done %, wrap %)', v_open, v_done, v_wrap;
  end if;
end
$$;

reset role;
do $$
begin
  raise notice 'PASS archive compat smoke';
end
$$;
