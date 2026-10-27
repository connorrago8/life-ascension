-- Versioned completion receipt is quest-scoped and reports newly awarded XP only once.
insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000b1');
-- Seed legacy instances as test administrator to exercise dates no longer creatable via public RPC.
insert into public.quests (id, owner_id, title, domain, cadence, scheduled_for, quest_type)
values ('00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-0000000000b1',
        'Legacy daily receipt boundary', 'personal_growth', 'daily',
        (now() at time zone 'America/Chicago')::date - 30, 'scheduled');
insert into public.quest_instances (id, owner_id, quest_id, due_date)
values
 ('00000000-0000-0000-0000-0000000000b5','00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000b4',(now() at time zone 'America/Chicago')::date - 3),
 ('00000000-0000-0000-0000-0000000000b6','00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000b4',(now() at time zone 'America/Chicago')::date + 1);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
select set_config('request.jwt.claim.role', '', false);
set role authenticated;

do $$
declare
  v_user uuid := '00000000-0000-0000-0000-0000000000b1';
  v_quest uuid;
  v_inst uuid;
  r jsonb;
  v_future uuid;
  v_future_inst uuid;
  v_archived uuid;
  v_archived_inst uuid;
  v_deferred uuid;
  v_deferred_inst uuid;
begin
  -- Use the supported API: authenticated direct INSERT into quests is deliberately denied.
  v_quest := public.create_scheduled_quest(
    'Receipt contract test', 'personal_growth', 'once',
    (now() at time zone 'America/Chicago')::date, 'scheduled'
  );
  v_inst := public.ensure_quest_instance(v_quest, (now() at time zone 'America/Chicago')::date);

  r := public.set_quest_instance_status_v2(v_inst,'complete');
  if r->>'schema_version' <> '1'
     or r->>'status' <> 'completed'
     or r->>'quest_instance_id' <> v_inst::text
     or r->>'quest_completion_confirmed' <> 'true'
     or r->>'reward_status' <> 'awarded'
     or r->>'xp_awarded' <> '1' then
    raise exception 'first completion receipt invalid: %', r;
  end if;

  r := public.set_quest_instance_status_v2(v_inst,'complete');
  if r->>'reward_status' <> 'already_awarded'
     or r->>'xp_awarded' <> '0'
     or r->>'quest_completion_confirmed' <> 'true' then
    raise exception 'duplicate completion receipt invalid: %', r;
  end if;

  if (select count(*) from public.xp_ledger where instance_id=v_inst) <> 1 then
    raise exception 'duplicate receipt created duplicate XP ledger entry';
  end if;

  begin
    perform public.set_quest_instance_status_v2('00000000-0000-0000-0000-0000000000ff','complete');
    raise exception 'unknown instance was accepted';
  exception when others then
    if sqlerrm = 'unknown instance was accepted' then raise; end if;
    if sqlerrm <> 'Instance not found' then raise; end if;
  end;


  -- A second authenticated identity must not complete the first user's instance.
  perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000b3',true);
  begin
    perform public.set_quest_instance_status_v2(v_inst,'complete');
    raise exception 'cross-owner request was accepted';
  exception when others then
    if sqlerrm <> 'Instance not found' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub',v_user::text,true);

  -- Deferral and resumption never earn XP and must preserve a valid status.
  v_deferred := public.create_scheduled_quest(
    'Defer resume receipt test','personal_growth','once',
    (now() at time zone 'America/Chicago')::date,'scheduled'
  );
  select id into v_deferred_inst from public.quest_instances where quest_id=v_deferred;
  r := public.set_quest_instance_status_v2(v_deferred_inst,'defer');
  if r->>'status' <> 'deferred' or r->>'reward_status' <> 'not_awarded'
     or r->>'xp_awarded' <> '0' or r->>'reward_confirmed' <> 'false'
     or r->>'quest_completion_confirmed' <> 'false' then
    raise exception 'defer receipt incorrectly awarded XP: %', r;
  end if;
  r := public.set_quest_instance_status_v2(v_deferred_inst,'resume');
  if r->>'status' <> 'available' or r->>'reward_status' <> 'not_awarded'
     or r->>'xp_awarded' <> '0' or r->>'reward_confirmed' <> 'false' then
    raise exception 'resume receipt incorrectly awarded XP: %', r;
  end if;
  if exists (select 1 from public.xp_ledger where instance_id=v_deferred_inst) then
    raise exception 'defer/resume created an XP ledger entry';
  end if;

  -- SQL NULL is not a valid action. In PL/pgSQL, NULL NOT IN (...) is NULL,
  -- not TRUE; reject explicitly rather than returning a misleading success receipt.
  begin
    perform public.set_quest_instance_status_v2(v_deferred_inst,null);
    raise exception 'null action was accepted';
  exception when others then
    if sqlerrm <> 'Unsupported action' then raise; end if;
  end;
  if exists (select 1 from public.xp_ledger where instance_id=v_deferred_inst) then
    raise exception 'null action created an XP ledger entry';
  end if;

  -- Future scheduled chores cannot be completed before their due date.
  v_future := public.create_scheduled_quest(
    'Future receipt test','personal_growth','once',
    (now() at time zone 'America/Chicago')::date + 1,'scheduled'
  );
  select id into v_future_inst from public.quest_instances where quest_id=v_future;
  begin
    perform public.set_quest_instance_status_v2(v_future_inst,'complete');
    raise exception 'future scheduled quest was accepted';
  exception when others then
    if sqlerrm <> 'Future scheduled quest cannot be completed yet' then raise; end if;
  end;

  -- An archived, uncompleted quest may not become completed or award XP.
  v_archived := public.create_scheduled_quest(
    'Archived receipt test','personal_growth','once',
    (now() at time zone 'America/Chicago')::date,'scheduled'
  );
  select id into v_archived_inst from public.quest_instances where quest_id=v_archived;
  perform public.archive_quest(v_archived);
  begin
    perform public.set_quest_instance_status_v2(v_archived_inst,'complete');
    raise exception 'archived quest was accepted';
  exception when others then
    if sqlerrm <> 'Active quest not found' then raise; end if;
  end;
  if (select count(*) from public.xp_ledger where instance_id in (v_future_inst,v_archived_inst)) <> 0 then
    raise exception 'forbidden quest awarded XP';
  end if;

  -- Future and outside-late-window daily instances must remain untouched.
  begin
    perform public.set_quest_instance_status_v2('00000000-0000-0000-0000-0000000000b5','complete');
    raise exception 'today-minus-3 daily was accepted';
  exception when others then
    if sqlerrm <> 'Daily quests can only be completed for today or the previous 2 days' then raise; end if;
  end;
  begin
    perform public.set_quest_instance_status_v2('00000000-0000-0000-0000-0000000000b6','complete');
    raise exception 'tomorrow daily was accepted';
  exception when others then
    if sqlerrm <> 'Future daily quests cannot be completed' then raise; end if;
  end;
  if exists (select 1 from public.xp_ledger where instance_id in
      ('00000000-0000-0000-0000-0000000000b5','00000000-0000-0000-0000-0000000000b6')) then
    raise exception 'ineligible daily earned XP';
  end if;

  -- An already completed quest can be retried after archival but cannot receive XP again.
  perform public.archive_quest(v_quest);
  r := public.set_quest_instance_status_v2(v_inst,'complete');
  if r->>'reward_status' <> 'already_awarded' or r->>'xp_awarded' <> '0'
     or (select count(*) from public.xp_ledger where instance_id=v_inst) <> 1 then
    raise exception 'completed-after-archive retry awarded extra XP: %', r;
  end if;

  begin
    perform public.set_quest_instance_status_v2(v_inst,'unsupported');
    raise exception 'unsupported action accepted';
  exception when others then
    if sqlerrm <> 'Unsupported action' then raise; end if;
  end;

  raise notice 'PASS v2 receipt first award, retry, ownership, schedule, archive guards';
end
$$;
reset role;
