-- Scheduling, XP, and API-key user-context checks.
-- Run via tests/sql/run-local.sh after migrations 0001 through 0005.
-- HTTP 401 is not produced by SQL. A revoked key makes authenticate_api_key return
-- no row; /api/mcp and /api/whoami map that miss to 401 with WWW-Authenticate: Bearer.

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000d1'),
  ('00000000-0000-0000-0000-0000000000d2');

create temporary table sched_ids (
  label text primary key,
  quest_id uuid,
  instance_id uuid,
  due_date date
);
grant select, insert on table sched_ids to authenticated, service_role;

-- Privileges: authenticated creates through the RPC, not a direct insert.
-- Service-role wrappers are not executable by anon or authenticated.
do $$
begin
  if has_table_privilege('authenticated', 'public.quests', 'insert') then
    raise exception 'authenticated still has insert on quests';
  end if;
  if has_table_privilege('anon', 'public.quests', 'insert') then
    raise exception 'anon still has insert on quests';
  end if;
  if not has_function_privilege('authenticated', 'public.create_scheduled_quest(text,text,text,date,text)', 'execute') then
    raise exception 'authenticated cannot execute create_scheduled_quest';
  end if;
  if not has_function_privilege('authenticated', 'public.add_quest_progress(uuid,text,integer,uuid,text)', 'execute') then
    raise exception 'authenticated cannot execute add_quest_progress';
  end if;
  if not has_function_privilege('authenticated', 'public.set_quest_instance_status(uuid,text)', 'execute') then
    raise exception 'authenticated cannot execute set_quest_instance_status';
  end if;
  if has_function_privilege('anon', 'public.create_scheduled_quest_as_user(uuid,text,text,text,date,text)', 'execute')
     or has_function_privilege('authenticated', 'public.create_scheduled_quest_as_user(uuid,text,text,text,date,text)', 'execute')
     or has_function_privilege('anon', 'public.ensure_quest_instance_as_user(uuid,uuid,date)', 'execute')
     or has_function_privilege('authenticated', 'public.ensure_quest_instance_as_user(uuid,uuid,date)', 'execute')
     or has_function_privilege('anon', 'public.set_quest_instance_status_as_user(uuid,uuid,text)', 'execute')
     or has_function_privilege('authenticated', 'public.set_quest_instance_status_as_user(uuid,uuid,text)', 'execute')
     or has_function_privilege('anon', 'public.add_quest_progress_as_user(uuid,uuid,text,integer,uuid,text)', 'execute')
     or has_function_privilege('authenticated', 'public.add_quest_progress_as_user(uuid,uuid,text,integer,uuid,text)', 'execute')
     or has_function_privilege('anon', 'public.get_lifetime_xp_as_user(uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.get_lifetime_xp_as_user(uuid)', 'execute')
     or has_function_privilege('anon', 'public._bind_service_role_user(uuid)', 'execute')
     or has_function_privilege('authenticated', 'public._bind_service_role_user(uuid)', 'execute')
     or has_function_privilege('service_role', 'public._bind_service_role_user(uuid)', 'execute') then
    raise exception 'user-context helper is executable outside the security definer owner';
  end if;
  if not has_function_privilege('service_role', 'public.create_scheduled_quest_as_user(uuid,text,text,text,date,text)', 'execute')
     or not has_function_privilege('service_role', 'public.set_quest_instance_status_as_user(uuid,uuid,text)', 'execute')
     or not has_function_privilege('service_role', 'public.add_quest_progress_as_user(uuid,uuid,text,integer,uuid,text)', 'execute')
     or not has_function_privilege('service_role', 'public.get_lifetime_xp_as_user(uuid)', 'execute') then
    raise exception 'service_role cannot execute the user-context wrappers';
  end if;
  if not has_table_privilege('service_role', 'public.quests', 'select')
     or not has_table_privilege('service_role', 'public.quest_instances', 'select') then
    raise exception 'service_role cannot select quests for the API-key path';
  end if;
  if has_table_privilege('service_role', 'public.quests', 'insert')
     or has_table_privilege('service_role', 'public.quests', 'update')
     or has_table_privilege('service_role', 'public.quests', 'delete') then
    raise exception 'service_role can write quests outside the RPC';
  end if;
end
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', false);
select set_config('request.jwt.claim.role', '', false);
select set_config('request.jwt.claims', '', false);
set role authenticated;

-- Schedule a one-time chore for the next Thursday after today (Chicago).
do $$
declare
  v_today date := (now() at time zone 'America/Chicago')::date;
  v_dow int := extract(dow from v_today)::int;
  v_add int := (4 - v_dow + 7) % 7;
  v_thu date;
  v_quest uuid;
  v_inst uuid;
  v_xp bigint;
begin
  if v_add = 0 then
    v_add := 7;
  end if;
  v_thu := v_today + v_add;
  if extract(dow from v_thu)::int <> 4 or v_thu <= v_today then
    raise exception 'next Thursday calculation failed: % (today %)', v_thu, v_today;
  end if;

  v_quest := public.create_scheduled_quest('Take out recycling', 'home', 'once', v_thu, 'scheduled');
  select id into v_inst
    from public.quest_instances
   where quest_id = v_quest
     and owner_id = '00000000-0000-0000-0000-0000000000d1';
  if v_inst is null then
    raise exception 'Thursday chore has no instance';
  end if;
  if (select scheduled_for from public.quests where id = v_quest) <> v_thu
     or (select quest_type from public.quests where id = v_quest) <> 'scheduled'
     or (select cadence from public.quests where id = v_quest) <> 'once'
     or (select due_date from public.quest_instances where id = v_inst) <> v_thu then
    raise exception 'Thursday chore was not stored on %', v_thu;
  end if;

  begin
    perform public.set_quest_instance_status(v_inst, 'complete');
    raise exception 'future scheduled chore completion was allowed';
  exception
    when others then
      if sqlerrm <> 'Future scheduled quest cannot be completed yet' then
        raise;
      end if;
  end;

  select coalesce(sum(amount), 0) into v_xp
    from public.xp_ledger
   where owner_id = '00000000-0000-0000-0000-0000000000d1';
  if v_xp <> 0 or (select status from public.quest_instances where id = v_inst) <> 'available' then
    raise exception 'rejected chore completion changed XP or status';
  end if;

  insert into sched_ids values ('thu_chore', v_quest, v_inst, v_thu);
  raise notice 'PASS schedule chore for next Thursday %', v_thu;
end
$$;

-- A daily habit dated in the future cannot be completed. A progress note does not award XP.
do $$
declare
  v_today date := (now() at time zone 'America/Chicago')::date;
  v_quest uuid;
  v_inst uuid;
  v_xp bigint;
begin
  v_quest := public.create_scheduled_quest('Morning stretch', 'physical_health', 'daily', v_today + 1, 'scheduled');
  select id into v_inst from public.quest_instances where quest_id = v_quest;
  if (select due_date from public.quest_instances where id = v_inst) <> v_today + 1 then
    raise exception 'future daily instance has the wrong due date';
  end if;

  begin
    perform public.set_quest_instance_status(v_inst, 'complete');
    raise exception 'future daily completion was allowed';
  exception
    when others then
      if sqlerrm <> 'Future daily quests cannot be completed' then
        raise;
      end if;
  end;

  perform public.add_quest_progress(v_quest, 'Stretched for five minutes', 25, v_inst, 'web');

  select coalesce(sum(amount), 0) into v_xp
    from public.xp_ledger
   where owner_id = '00000000-0000-0000-0000-0000000000d1';
  if v_xp <> 0
     or (select status from public.quest_instances where id = v_inst) <> 'available'
     or (select count(*) from public.quest_progress where quest_id = v_quest and note = 'Stretched for five minutes') <> 1 then
    raise exception 'future daily note awarded XP or changed status';
  end if;

  insert into sched_ids values ('future_daily', v_quest, v_inst, v_today + 1);
  raise notice 'PASS future daily habit cannot be completed and its note awards no XP';
end
$$;

-- A deadline goal can be completed before its date. The second completion adds no XP.
-- A later progress note still awards no XP.
do $$
declare
  v_thu date;
  v_quest uuid;
  v_inst uuid;
  v_xp bigint;
  v_events int;
  v_first text;
  v_second text;
begin
  select due_date into v_thu from sched_ids where label = 'thu_chore';
  v_quest := public.create_scheduled_quest('File the form', 'career', 'once', v_thu, 'goal');
  select id into v_inst from public.quest_instances where quest_id = v_quest;
  if (select due_date from public.quest_instances where id = v_inst) <= (now() at time zone 'America/Chicago')::date then
    raise exception 'goal deadline is not in the future';
  end if;

  v_first := public.set_quest_instance_status(v_inst, 'complete');
  v_second := public.set_quest_instance_status(v_inst, 'complete');
  perform public.add_quest_progress(v_quest, 'Filed it this morning', 100, v_inst, 'api');

  select coalesce(sum(amount), 0) into v_xp
    from public.xp_ledger
   where instance_id = v_inst;
  select count(*) into v_events
    from public.quest_events
   where instance_id = v_inst
     and event_type = 'completed';

  if v_first <> 'completed' or v_second <> 'completed' then
    raise exception 'goal completion results were % then %', v_first, v_second;
  end if;
  if v_xp <> 1 or v_events <> 1 then
    raise exception 'XP or completion events were not exactly once (xp %, events %)', v_xp, v_events;
  end if;
  if (select status from public.quest_instances where id = v_inst) <> 'completed' then
    raise exception 'early goal completion did not stick';
  end if;
  if (select count(*) from public.quest_progress where quest_id = v_quest and note = 'Filed it this morning') <> 1 then
    raise exception 'goal progress note was not saved';
  end if;
  if (select coalesce(sum(amount), 0) from public.xp_ledger where owner_id = '00000000-0000-0000-0000-0000000000d1') <> 1 then
    raise exception 'progress note changed lifetime XP';
  end if;
  if public.get_lifetime_xp() <> 1 then
    raise exception 'get_lifetime_xp did not return the single awarded point';
  end if;

  insert into sched_ids values ('goal', v_quest, v_inst, v_thu);
  raise notice 'PASS deadline goal completed early; XP awarded once; note awarded none';
end
$$;

-- Direct INSERT into quests is denied for an authenticated session.
do $$
begin
  begin
    insert into public.quests (owner_id, title, domain, cadence)
    values ('00000000-0000-0000-0000-0000000000d1', 'Sneaky quest', 'home', 'once');
    raise exception 'direct quest insert was allowed';
  exception
    when insufficient_privilege then
      null;
  end;
  if exists (select 1 from public.quests where title = 'Sneaky quest') then
    raise exception 'denied insert still stored a quest';
  end if;
  raise notice 'PASS direct INSERT on quests denied for authenticated';
end
$$;

-- Forging the service-role claim does not grant the wrappers.
do $$
declare
  v_thu date;
begin
  perform set_config('request.jwt.claim.role', 'service_role', false);
  select due_date into v_thu from sched_ids where label = 'thu_chore';
  begin
    perform public.create_scheduled_quest_as_user(
      '00000000-0000-0000-0000-0000000000d1',
      'Forged role',
      'home',
      'once',
      v_thu,
      'scheduled'
    );
    raise exception 'authenticated executed create_scheduled_quest_as_user';
  exception
    when insufficient_privilege then
      null;
  end;
  raise notice 'PASS authenticated cannot call user-context wrappers';
end
$$;

reset role;
select set_config('request.jwt.claim.sub', '', false);
select set_config('request.jwt.claim.role', '', false);
select set_config('request.jwt.claims', '', false);

-- Revoked personal key: lookup returns no row. The HTTP routes turn that into 401.
insert into public.api_keys (user_id, name, prefix, key_hash)
values (
  '00000000-0000-0000-0000-0000000000d1',
  'Phone',
  'la_live_dddddddd',
  encode(public.digest('la_live_' || repeat('d', 43), 'sha256'), 'hex')
);

set role service_role;
do $$
declare n int;
begin
  select count(*) into n
    from public.authenticate_api_key(encode(public.digest('la_live_' || repeat('d', 43), 'sha256'), 'hex'));
  if n <> 1 then
    raise exception 'active API key did not authenticate';
  end if;
end
$$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', false);
select set_config('request.jwt.claim.role', '', false);
do $$
begin
  perform public.revoke_api_key((
    select id from public.api_keys where prefix = 'la_live_dddddddd'
  ));
end
$$;
reset role;

set role service_role;
do $$
declare n int;
begin
  select count(*) into n
    from public.authenticate_api_key(encode(public.digest('la_live_' || repeat('d', 43), 'sha256'), 'hex'));
  if n <> 0 then
    raise exception 'revoked API key still authenticated';
  end if;
  raise notice 'PASS revoked API key lookup returns no row';
end
$$;

-- Without the service-role JWT claim, the wrapper fails closed.
do $$
declare v_thu date;
begin
  perform set_config('request.jwt.claim.role', '', false);
  perform set_config('request.jwt.claims', '', false);
  select due_date into v_thu from sched_ids where label = 'thu_chore';
  begin
    perform public.create_scheduled_quest_as_user(
      '00000000-0000-0000-0000-0000000000d1',
      'Missing claim',
      'home',
      'once',
      v_thu,
      'scheduled'
    );
    raise exception 'wrapper ran without a service_role claim';
  exception
    when others then
      if sqlerrm <> 'Forbidden' then
        raise;
      end if;
  end;
  raise notice 'PASS wrapper rejects a service_role session with no role claim';
end
$$;

-- With the claim, the wrapper acts as p_user_id for this transaction only.
do $$
declare
  v_thu date;
  v_quest uuid;
  v_inst uuid;
  v_note uuid;
  v_xp bigint;
  v_owner uuid;
begin
  perform set_config('request.jwt.claim.role', 'service_role', false);
  select due_date into v_thu from sched_ids where label = 'thu_chore';

  v_quest := public.create_scheduled_quest_as_user(
    '00000000-0000-0000-0000-0000000000d1',
    'API scheduled chore',
    'home',
    'once',
    v_thu,
    'scheduled'
  );
  select owner_id, id into v_owner, v_inst
    from public.quest_instances
   where quest_id = v_quest;
  if v_owner <> '00000000-0000-0000-0000-0000000000d1' then
    raise exception 'API-key wrapper created the quest for %', v_owner;
  end if;

  begin
    perform public.set_quest_instance_status_as_user(
      '00000000-0000-0000-0000-0000000000d1',
      v_inst,
      'complete'
    );
    raise exception 'API-key path completed a future chore';
  exception
    when others then
      if sqlerrm <> 'Future scheduled quest cannot be completed yet' then
        raise;
      end if;
  end;

  v_note := public.add_quest_progress_as_user(
    '00000000-0000-0000-0000-0000000000d1',
    v_quest,
    'Bought bags',
    null,
    v_inst,
    'grok'
  );
  if v_note is null then
    raise exception 'API-key progress note was not saved';
  end if;

  select public.get_lifetime_xp_as_user('00000000-0000-0000-0000-0000000000d1') into v_xp;
  if v_xp <> 1 then
    raise exception 'get_lifetime_xp_as_user returned % after a note', v_xp;
  end if;

  insert into sched_ids values ('api_chore', v_quest, v_inst, v_thu);
  raise notice 'PASS service-role wrapper schedules, notes, and reads XP for p_user_id';
end
$$;

-- The transaction-local user pin does not replace the session subject.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d2', false);
do $$
declare
  v_thu date;
  v_quest uuid;
begin
  perform set_config('request.jwt.claim.role', 'service_role', false);
  select due_date into v_thu from sched_ids where label = 'thu_chore';
  v_quest := public.create_scheduled_quest_as_user(
    '00000000-0000-0000-0000-0000000000d1',
    'Pinned only inside the call',
    'home',
    'once',
    v_thu,
    'scheduled'
  );
  if (select owner_id from public.quests where id = v_quest) <> '00000000-0000-0000-0000-0000000000d1' then
    raise exception 'wrapper ignored p_user_id';
  end if;
end
$$;

do $$
begin
  if auth.uid() is distinct from '00000000-0000-0000-0000-0000000000d2'::uuid then
    raise exception 'transaction-local user pin leaked into the session (% )', auth.uid();
  end if;
  raise notice 'PASS user pin did not leak past the wrapper call';
end
$$;

-- Alice's wrapper cannot complete Bob's instance.
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d2', false);
select set_config('request.jwt.claim.role', '', false);
set role authenticated;
do $$
declare
  v_today date := (now() at time zone 'America/Chicago')::date;
  v_quest uuid;
  v_inst uuid;
begin
  v_quest := public.create_scheduled_quest('Bob goal', 'personal_growth', 'once', v_today, 'goal');
  select id into v_inst from public.quest_instances where quest_id = v_quest;
  insert into sched_ids values ('bob_goal', v_quest, v_inst, v_today);
end
$$;

reset role;
select set_config('request.jwt.claim.role', 'service_role', false);
select set_config('request.jwt.claim.sub', '', false);
set role service_role;
do $$
declare v_inst uuid;
begin
  select instance_id into v_inst from sched_ids where label = 'bob_goal';
  begin
    perform public.set_quest_instance_status_as_user(
      '00000000-0000-0000-0000-0000000000d1',
      v_inst,
      'complete'
    );
    raise exception 'Alice wrapper completed Bob instance';
  exception
    when others then
      if sqlerrm <> 'Instance not found' then
        raise;
      end if;
  end;
  if (select status from public.quest_instances where id = v_inst) <> 'available' then
    raise exception 'cross-user completion changed Bob status';
  end if;
  if public.get_lifetime_xp_as_user('00000000-0000-0000-0000-0000000000d2') <> 0 then
    raise exception 'Bob gained XP from a rejected completion';
  end if;
  raise notice 'PASS user-context wrapper cannot complete another user instance';
end
$$;

reset role;
do $$
declare notes int;
declare xp int;
begin
  if exists (select 1 from public.quests where title = 'Sneaky quest') then
    raise exception 'direct insert row exists after the script';
  end if;
  select count(*) into notes
    from public.quest_progress
   where user_id = '00000000-0000-0000-0000-0000000000d1'
     and note = 'Bought bags';
  select count(*) into xp
    from public.xp_ledger
   where owner_id = '00000000-0000-0000-0000-0000000000d1';
  if notes <> 1 or xp <> 1 then
    raise exception 'API-key note changed the ledger (notes %, xp %)', notes, xp;
  end if;
  raise notice 'PASS scheduling auth smoke';
end
$$;
