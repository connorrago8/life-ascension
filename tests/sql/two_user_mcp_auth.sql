-- Two users, two API keys, and the list_quests active-instance rule.
-- Run via tests/sql/run-local.sh after migrations 0001 through 0005.
-- The HTTP 401 for a revoked key is the route mapping of an empty authenticate_api_key row.

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000e1'),
  ('00000000-0000-0000-0000-0000000000e2');

insert into public.api_keys (user_id, name, prefix, key_hash) values
  (
    '00000000-0000-0000-0000-0000000000e1',
    'Alice phone',
    'la_live_eeeeeeee',
    encode(public.digest('la_live_' || repeat('e', 43), 'sha256'), 'hex')
  ),
  (
    '00000000-0000-0000-0000-0000000000e2',
    'Bob phone',
    'la_live_ffffffff',
    encode(public.digest('la_live_' || repeat('f', 43), 'sha256'), 'hex')
  );

create temporary table pair_ids (
  label text primary key,
  user_id uuid,
  quest_id uuid,
  instance_id uuid
);
grant select, insert, update on table pair_ids to authenticated, service_role;

select set_config('request.jwt.claim.role', 'service_role', false);
select set_config('request.jwt.claim.sub', '', false);
select set_config('request.jwt.claims', '', false);
set role service_role;

do $$
declare
  v_today date := (now() at time zone 'America/Chicago')::date;
  v_alice uuid := '00000000-0000-0000-0000-0000000000e1';
  v_bob uuid := '00000000-0000-0000-0000-0000000000e2';
  v_alice_goal uuid;
  v_bob_goal uuid;
  v_alice_archived uuid;
  v_alice_inst uuid;
  v_bob_inst uuid;
  v_archived_inst uuid;
  v_created uuid;
  n int;
begin
  v_alice_goal := public.create_scheduled_quest_as_user(v_alice, 'Alice goal', 'career', 'once', v_today, 'goal');
  v_bob_goal := public.create_scheduled_quest_as_user(v_bob, 'Bob goal', 'home', 'once', v_today, 'goal');
  v_alice_archived := public.create_scheduled_quest_as_user(v_alice, 'Alice archived', 'home', 'once', v_today, 'scheduled');
  select id into v_alice_inst from public.quest_instances where quest_id = v_alice_goal;
  select id into v_bob_inst from public.quest_instances where quest_id = v_bob_goal;
  select id into v_archived_inst from public.quest_instances where quest_id = v_alice_archived;
  insert into pair_ids values
    ('alice_goal', v_alice, v_alice_goal, v_alice_inst),
    ('bob_goal', v_bob, v_bob_goal, v_bob_inst),
    ('alice_archived', v_alice, v_alice_archived, v_archived_inst);

  if (select owner_id from public.quests where id = v_alice_goal) <> v_alice
     or (select owner_id from public.quests where id = v_bob_goal) <> v_bob then
    raise exception 'wrapper created a quest for the wrong user';
  end if;

  select count(*) into n from public.quests where owner_id = v_bob;
  v_created := public.create_scheduled_quest_as_user(v_alice, 'Alice only', 'home', 'once', v_today, 'scheduled');
  if (select owner_id from public.quests where id = v_created) <> v_alice
     or (select count(*) from public.quests where owner_id = v_bob) <> n then
    raise exception 'Alice create wrote a Bob quest';
  end if;

  begin
    perform public.add_quest_progress_as_user(v_alice, v_bob_goal, 'stolen note', null, v_bob_inst, 'api');
    raise exception 'Alice added progress to Bob';
  exception
    when others then
      if sqlerrm <> 'Quest not found' then
        raise;
      end if;
  end;
  begin
    perform public.add_quest_progress_as_user(v_bob, v_alice_goal, 'stolen note', null, v_alice_inst, 'api');
    raise exception 'Bob added progress to Alice';
  exception
    when others then
      if sqlerrm <> 'Quest not found' then
        raise;
      end if;
  end;

  begin
    perform public.set_quest_instance_status_as_user(v_alice, v_bob_inst, 'complete');
    raise exception 'Alice completed Bob instance';
  exception
    when others then
      if sqlerrm <> 'Instance not found' then
        raise;
      end if;
  end;
  begin
    perform public.ensure_quest_instance_as_user(v_alice, v_bob_goal, v_today);
    raise exception 'Alice ensured Bob instance';
  exception
    when others then
      if sqlerrm <> 'Quest not found' then
        raise;
      end if;
  end;

  if public.set_quest_instance_status_as_user(v_alice, v_alice_inst, 'complete') <> 'completed'
     or public.get_lifetime_xp_as_user(v_alice) <> 1
     or public.get_lifetime_xp_as_user(v_bob) <> 0 then
    raise exception 'Alice completion changed Bob XP or missed her own';
  end if;
  if public.set_quest_instance_status_as_user(v_bob, v_bob_inst, 'complete') <> 'completed'
     or public.get_lifetime_xp_as_user(v_bob) <> 1
     or public.get_lifetime_xp_as_user(v_alice) <> 1 then
    raise exception 'Bob completion changed Alice XP';
  end if;

  perform public.add_quest_progress_as_user(v_alice, v_alice_goal, 'Alice note', 40, v_alice_inst, 'api');
  if (select count(*) from public.quest_progress where user_id = v_bob) <> 0
     or public.get_lifetime_xp_as_user(v_alice) <> 1 then
    raise exception 'Alice note leaked to Bob or awarded XP';
  end if;

  raise notice 'PASS two-user wrappers keep quests, notes, completion, and XP apart';
end
$$;

reset role;
update public.quests
   set active = false
 where id = (select quest_id from pair_ids where label = 'alice_archived');

-- Same predicate list_quests uses: owner_id plus the active quest id set.
do $$
declare
  v_today date := (now() at time zone 'America/Chicago')::date;
  v_alice uuid := '00000000-0000-0000-0000-0000000000e1';
  n int;
begin
  select count(*) into n
    from public.quest_instances i
   where i.owner_id = v_alice
     and i.quest_id in (select q.id from public.quests q where q.owner_id = v_alice and q.active)
     and i.due_date = v_today;
  if n <> 2 then
    raise exception 'active owned instances for today = %, expected 2 (goal plus the extra create)', n;
  end if;
  if exists (
    select 1
      from public.quest_instances i
     where i.owner_id = v_alice
       and i.quest_id in (select q.id from public.quests q where q.owner_id = v_alice and q.active)
       and i.quest_id = (select quest_id from pair_ids where label = 'alice_archived')
  ) then
    raise exception 'inactive quest instance survived the list filter';
  end if;
  if exists (
    select 1
      from public.quest_instances i
     where i.owner_id = v_alice
       and i.quest_id in (select q.id from public.quests q where q.owner_id = v_alice and q.active)
       and i.owner_id <> v_alice
  ) or exists (
    select 1
      from public.quests q
     where q.owner_id = v_alice
       and q.active
       and q.owner_id = '00000000-0000-0000-0000-0000000000e2'
  ) then
    raise exception 'list filter included Bob';
  end if;
  if exists (
    select 1
      from public.quest_instances i
      join public.quests q on q.id = i.quest_id and q.owner_id = i.owner_id
     where i.owner_id = v_alice
       and q.active
       and i.quest_id = (select quest_id from pair_ids where label = 'bob_goal')
  ) then
    raise exception 'Alice list join returned Bob instance';
  end if;
  raise notice 'PASS list filter returns instances only for active quests owned by the caller';
end
$$;

-- JWT-scoped reads follow RLS. Alice sees only her quests.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false);
select set_config('request.jwt.claim.role', '', false);
set role authenticated;
do $$
declare n int;
begin
  select count(*) into n from public.quests;
  if n <> 3 then
    raise exception 'Alice RLS quest count %, expected 3', n;
  end if;
  if exists (select 1 from public.quests where owner_id = '00000000-0000-0000-0000-0000000000e2') then
    raise exception 'Alice can read Bob quests';
  end if;
  begin
    perform public.set_quest_instance_status((select instance_id from pair_ids where label = 'bob_goal'), 'complete');
    raise exception 'Alice JWT completed Bob instance';
  exception
    when others then
      if sqlerrm <> 'Instance not found' then
        raise;
      end if;
  end;
  raise notice 'PASS Alice JWT cannot read or complete Bob';
end
$$;

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e2', false);
set role authenticated;
do $$
declare n int;
begin
  select count(*) into n from public.quests where title like 'Alice%';
  if n <> 0 then
    raise exception 'Bob can read Alice quests';
  end if;
  begin
    perform public.add_quest_progress((select quest_id from pair_ids where label = 'alice_goal'), 'nope', null, null, 'api');
    raise exception 'Bob JWT added Alice progress';
  exception
    when others then
      if sqlerrm <> 'Quest not found' then
        raise;
      end if;
  end;
  raise notice 'PASS Bob JWT cannot read or note Alice';
end
$$;

reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false);
do $$
begin
  perform public.revoke_api_key((select id from public.api_keys where prefix = 'la_live_eeeeeeee'));
end
$$;

reset role;
select set_config('request.jwt.claim.role', 'service_role', false);
set role service_role;
do $$
declare n int;
begin
  select count(*) into n
    from public.authenticate_api_key(encode(public.digest('la_live_' || repeat('e', 43), 'sha256'), 'hex'));
  if n <> 0 then
    raise exception 'revoked Alice key still authenticates';
  end if;
  select count(*) into n
    from public.authenticate_api_key(encode(public.digest('la_live_' || repeat('f', 43), 'sha256'), 'hex'));
  if n <> 1 then
    raise exception 'Bob key stopped working when Alice was revoked';
  end if;
  if public.get_lifetime_xp_as_user('00000000-0000-0000-0000-0000000000e1') <> 1
     or public.get_lifetime_xp_as_user('00000000-0000-0000-0000-0000000000e2') <> 1 then
    raise exception 'revoking Alice changed XP';
  end if;
  raise notice 'PASS revoked Alice key is rejected and Bob still authenticates';
end
$$;

reset role;
do $$
begin
  if (select count(*) from public.xp_ledger where owner_id = '00000000-0000-0000-0000-0000000000e1') <> 1
     or (select count(*) from public.xp_ledger where owner_id = '00000000-0000-0000-0000-0000000000e2') <> 1 then
    raise exception 'final ledger is not one row per user';
  end if;
  raise notice 'PASS two-user mcp auth smoke';
end
$$;
