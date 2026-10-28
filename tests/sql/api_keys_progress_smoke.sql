-- Security behavior for api keys and quest progress. Run via tests/sql/run-local.sh.
-- Expects the prelude, core migration, and 202610230002 migration to be applied.

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000a2');

insert into public.quests (id, owner_id, title, domain, cadence) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'Fold laundry', 'home', 'daily'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a2', 'Other quest', 'home', 'once'),
  ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000a1', 'Water plants', 'home', 'once');

insert into public.quest_instances (id, owner_id, quest_id, due_date, status) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', '2026-10-23', 'available'),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b2', '2026-10-23', 'available'),
  ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b3', '2026-10-23', 'available');

insert into public.api_keys (user_id, name, prefix, key_hash)
values (
  '00000000-0000-0000-0000-0000000000a1',
  'Laptop',
  'la_live_aaaaaaaa',
  encode(public.digest('la_live_' || repeat('a', 43), 'sha256'), 'hex')
);

insert into public.api_keys (user_id, name, prefix, key_hash)
values (
  '00000000-0000-0000-0000-0000000000a2',
  'Other laptop',
  'la_live_bbbbbbbb',
  encode(public.digest('la_live_' || repeat('b', 43), 'sha256'), 'hex')
);

-- Privileges
do $$
begin
  if has_function_privilege('authenticated', 'public.authenticate_api_key(text)', 'execute') then
    raise exception 'authenticated can execute authenticate_api_key';
  end if;
  if has_function_privilege('anon', 'public.authenticate_api_key(text)', 'execute') then
    raise exception 'anon can execute authenticate_api_key';
  end if;
  if not has_function_privilege('service_role', 'public.authenticate_api_key(text)', 'execute') then
    raise exception 'service_role cannot execute authenticate_api_key';
  end if;
  if not has_function_privilege('authenticated', 'public.add_quest_progress(uuid,text,integer,uuid,text)', 'execute') then
    raise exception 'authenticated cannot add progress';
  end if;
  if has_function_privilege('anon', 'public.add_quest_progress(uuid,text,integer,uuid,text)', 'execute') then
    raise exception 'anon can add progress';
  end if;
  if not has_function_privilege('authenticated', 'public.revoke_api_key(uuid)', 'execute') then
    raise exception 'authenticated cannot revoke keys';
  end if;
  if has_table_privilege('authenticated', 'public.api_keys', 'insert,update,delete') then
    raise exception 'authenticated can mutate api_keys';
  end if;
  if has_table_privilege('authenticated', 'public.quest_progress', 'insert,update,delete') then
    raise exception 'authenticated can mutate quest_progress';
  end if;
  if has_column_privilege('authenticated', 'public.api_keys', 'key_hash', 'select') then
    raise exception 'authenticated can select key_hash';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'api_keys_safe' and column_name = 'key_hash'
  ) then
    raise exception 'api_keys_safe exposes key_hash';
  end if;
  if not exists (
    select 1 from pg_proc
    where proname = 'add_quest_progress'
      and exists (select 1 from unnest(proconfig) cfg where cfg like 'search_path=%')
  ) then
    raise exception 'add_quest_progress search_path is not pinned';
  end if;
  if not exists (
    select 1 from pg_proc
    where proname = 'authenticate_api_key'
      and exists (select 1 from unnest(proconfig) cfg where cfg like 'search_path=%')
  ) then
    raise exception 'authenticate_api_key search_path is not pinned';
  end if;
  if position('xp_ledger' in pg_get_functiondef('public.add_quest_progress(uuid,text,integer,uuid,text)'::regprocedure)) > 0 then
    raise exception 'add_quest_progress references xp_ledger';
  end if;
  if position('xp_ledger' in pg_get_functiondef('public.set_quest_instance_status(uuid,text)'::regprocedure)) = 0
     and not (position('set_quest_instance_status_v2' in pg_get_functiondef('public.set_quest_instance_status(uuid,text)'::regprocedure)) > 0
       and position('xp_ledger' in pg_get_functiondef(to_regprocedure('public.set_quest_instance_status_v2(uuid,text)'))) > 0) then
    raise exception 'existing completion function was replaced';
  end if;
end
$$;

-- Successful lookup, then constant rejection of a revoked key.
set role service_role;
select public.authenticate_api_key(encode(public.digest('la_live_' || repeat('a', 43), 'sha256'), 'hex'));
reset role;

do $$
declare used timestamptz;
begin
  select last_used_at into used
    from public.api_keys
   where prefix = 'la_live_aaaaaaaa';
  if used is null then
    raise exception 'successful auth did not stamp last_used_at';
  end if;
end
$$;

-- Wrong digest and revoked digest return no row.
set role service_role;
do $$
declare n int;
begin
  select count(*) into n
    from public.authenticate_api_key(encode(public.digest('la_live_' || repeat('c', 43), 'sha256'), 'hex'));
  if n <> 0 then
    raise exception 'unknown key authenticated';
  end if;
  select count(*) into n from public.authenticate_api_key('not-a-hash');
  if n <> 0 then
    raise exception 'malformed hash authenticated';
  end if;
end
$$;
reset role;

-- Owner can read the safe view. The other user cannot see that key.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
do $$
declare n int;
begin
  select count(*) into n from public.api_keys_safe;
  if n <> 1 then
    raise exception 'owner safe view count %, expected 1', n;
  end if;
  select count(*) into n from public.api_keys;
  if n <> 1 then
    raise exception 'owner table count %, expected 1', n;
  end if;
end
$$;

do $$
begin
  begin
    perform key_hash from public.api_keys;
    raise exception 'key_hash select should fail';
  exception
    when insufficient_privilege then
      null;
  end;
  begin
    insert into public.api_keys (user_id, name, prefix, key_hash)
    values ('00000000-0000-0000-0000-0000000000a1', 'Nope', 'la_live_cccccccc', repeat('ab', 32));
    raise exception 'direct api key insert should fail';
  exception
    when insufficient_privilege then
      null;
  end;
end
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', false);
do $$
declare n int;
begin
  select count(*) into n from public.api_keys_safe where prefix = 'la_live_aaaaaaaa';
  if n <> 0 then
    raise exception 'user B can see user A key';
  end if;
  begin
    perform public.revoke_api_key((select id from public.api_keys where false));
  exception
    when others then
      null;
  end;
end
$$;

-- B cannot revoke A's key. The id is looked up as the table owner inside a definer function,
-- so pass it from a superuser-side temp value captured before the role switch.
reset role;
create temporary table key_ids as
  select id, prefix from public.api_keys;
grant select on table key_ids to authenticated;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', false);
do $$
declare target uuid;
begin
  select id into target from key_ids where prefix = 'la_live_aaaaaaaa';
  begin
    perform public.revoke_api_key(target);
    raise exception 'user B revoked user A key';
  exception
    when others then
      if sqlerrm <> 'API key not found' then
        raise;
      end if;
  end;
end
$$;

reset role;
do $$
begin
  if exists (select 1 from public.api_keys where prefix = 'la_live_aaaaaaaa' and revoked_at is not null) then
    raise exception 'rejected revoke still marked the key revoked';
  end if;
end
$$;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
do $$
declare target uuid;
begin
  select id into target from key_ids where prefix = 'la_live_aaaaaaaa';
  perform public.revoke_api_key(target);
end
$$;

reset role;
do $$
declare revoked_at timestamptz;
begin
  select k.revoked_at into revoked_at from public.api_keys k where prefix = 'la_live_aaaaaaaa';
  if revoked_at is null then
    raise exception 'owner revoke did not stick';
  end if;
end
$$;

set role service_role;
do $$
declare n int;
declare used timestamptz;
begin
  select last_used_at into used from public.api_keys where prefix = 'la_live_aaaaaaaa';
  select count(*) into n
    from public.authenticate_api_key(encode(public.digest('la_live_' || repeat('a', 43), 'sha256'), 'hex'));
  if n <> 0 then
    raise exception 'revoked key authenticated';
  end if;
  if (select last_used_at from public.api_keys where prefix = 'la_live_aaaaaaaa') is distinct from used then
    raise exception 'revoked key changed last_used_at';
  end if;
end
$$;
reset role;

-- Progress notes.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
select public.add_quest_progress(
  '00000000-0000-0000-0000-0000000000b1',
  '  Folded half the basket  ',
  40,
  '00000000-0000-0000-0000-0000000000c1',
  'web'
);

do $$
declare n int;
begin
  select count(*) into n
    from public.quest_progress
   where quest_id = '00000000-0000-0000-0000-0000000000b1'
     and note = 'Folded half the basket'
     and percent = 40
     and source = 'web'
     and instance_id = '00000000-0000-0000-0000-0000000000c1';
  if n <> 1 then
    raise exception 'owned progress note missing';
  end if;
  begin
    perform public.add_quest_progress('00000000-0000-0000-0000-0000000000b2', 'stolen', null, null, 'api');
    raise exception 'cross-user progress should fail';
  exception
    when others then
      if sqlerrm <> 'Quest not found' then
        raise;
      end if;
  end;
  begin
    perform public.add_quest_progress(
      '00000000-0000-0000-0000-0000000000b1',
      'wrong instance',
      null,
      '00000000-0000-0000-0000-0000000000c2',
      'web'
    );
    raise exception 'foreign instance should fail';
  exception
    when others then
      if sqlerrm <> 'Instance not found' then
        raise;
      end if;
  end;
  begin
    perform public.add_quest_progress('00000000-0000-0000-0000-0000000000b1', repeat('n', 1001), null, null, 'web');
    raise exception 'long note should fail';
  exception
    when others then
      if sqlerrm <> 'Note must be 1 to 1000 characters' then
        raise;
      end if;
  end;
  begin
    perform public.add_quest_progress('00000000-0000-0000-0000-0000000000b1', '   ', 10, null, 'web');
    raise exception 'blank note should fail';
  exception
    when others then
      if sqlerrm <> 'Note must be 1 to 1000 characters' then
        raise;
      end if;
  end;
  begin
    perform public.add_quest_progress('00000000-0000-0000-0000-0000000000b1', 'too far', 101, null, 'web');
    raise exception 'percent 101 should fail';
  exception
    when others then
      if sqlerrm <> 'Percent must be between 0 and 100' then
        raise;
      end if;
  end;
  begin
    perform public.add_quest_progress('00000000-0000-0000-0000-0000000000b1', 'bad source', null, null, 'email');
    raise exception 'bad source should fail';
  exception
    when others then
      if sqlerrm <> 'Unsupported source' then
        raise;
      end if;
  end;
  begin
    insert into public.quest_progress (user_id, quest_id, note, source)
    values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'direct', 'web');
    raise exception 'direct progress insert should fail';
  exception
    when insufficient_privilege then
      null;
  end;
end
$$;

select public.add_quest_progress(
  '00000000-0000-0000-0000-0000000000b3',
  'Watered once',
  100,
  '00000000-0000-0000-0000-0000000000c3',
  'grok'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', false);
do $$
declare n int;
begin
  select count(*) into n from public.quest_progress;
  if n <> 0 then
    raise exception 'user B can read user A progress notes (%)', n;
  end if;
end
$$;

reset role;
do $$
declare
  xp int;
  laundry text;
  plants text;
begin
  select count(*) into xp from public.xp_ledger;
  select status into laundry from public.quest_instances where id = '00000000-0000-0000-0000-0000000000c1';
  select status into plants from public.quest_instances where id = '00000000-0000-0000-0000-0000000000c3';
  if xp <> 0 or laundry <> 'available' or plants <> 'available' then
    raise exception 'progress changed xp or status (xp %, laundry %, plants %)', xp, laundry, plants;
  end if;
end
$$;

-- Deleting an instance clears the link and keeps the note.
delete from public.quest_instances where id = '00000000-0000-0000-0000-0000000000c3';
do $$
declare linked uuid;
begin
  select instance_id into linked
    from public.quest_progress
   where note = 'Watered once';
  if linked is not null then
    raise exception 'instance delete did not clear instance_id';
  end if;
end
$$;

-- Deleting the quest removes its notes.
delete from public.quests where id = '00000000-0000-0000-0000-0000000000b1';
do $$
declare n int;
begin
  select count(*) into n from public.quest_progress where quest_id = '00000000-0000-0000-0000-0000000000b1';
  if n <> 0 then
    raise exception 'quest delete left progress notes';
  end if;
end
$$;

-- Deleting the user removes their keys and remaining notes.
delete from auth.users where id = '00000000-0000-0000-0000-0000000000a1';
do $$
declare keys int;
declare notes int;
declare quests int;
begin
  select count(*) into keys from public.api_keys where user_id = '00000000-0000-0000-0000-0000000000a1';
  select count(*) into notes from public.quest_progress where user_id = '00000000-0000-0000-0000-0000000000a1';
  select count(*) into quests from public.quests where owner_id = '00000000-0000-0000-0000-0000000000a1';
  if keys <> 0 or notes <> 0 or quests <> 0 then
    raise exception 'user delete left rows (keys %, notes %, quests %)', keys, notes, quests;
  end if;
  if not exists (select 1 from public.api_keys where prefix = 'la_live_bbbbbbbb') then
    raise exception 'user delete removed another user key';
  end if;
end
$$;
