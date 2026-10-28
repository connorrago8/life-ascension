-- Combined, disposable PostgreSQL regression: PR #21 migrations 0001-0012,
-- followed by PR #31 v2. This file is a test, NEVER a hosted migration.
-- Standalone v2 legacy-schema coverage remains in quest_receipt_v2_smoke.sql.
insert into auth.users(id) values
 ('00000000-0000-0000-0000-0000000000a7'),
 ('00000000-0000-0000-0000-0000000000a8');

insert into public.quests
 (id,owner_id,title,domain,cadence,scheduled_for,quest_type,target_amount,progress_unit,progress_increment)
values
 ('00000000-0000-0000-0000-000000000a71','00000000-0000-0000-0000-0000000000a7',
  'Combined clear and legacy receipt','home','once',(now() at time zone 'America/Chicago')::date,
  'scheduled',8,'units',2),
 ('00000000-0000-0000-0000-000000000a72','00000000-0000-0000-0000-0000000000a7',
  'Combined fresh v2 award','home','once',(now() at time zone 'America/Chicago')::date,
  'scheduled',8,'units',2),
 ('00000000-0000-0000-0000-000000000a81','00000000-0000-0000-0000-0000000000a8',
  'Second owner RLS fixture','home','once',(now() at time zone 'America/Chicago')::date,
  'scheduled',10,'units',1);

insert into public.quest_instances
 (id,owner_id,quest_id,due_date,current_amount)
values
 ('00000000-0000-0000-0000-000000000a73','00000000-0000-0000-0000-0000000000a7',
  '00000000-0000-0000-0000-000000000a71',(now() at time zone 'America/Chicago')::date,0),
 -- A full target without a completion event tests the v2 award path independently.
 ('00000000-0000-0000-0000-000000000a74','00000000-0000-0000-0000-0000000000a7',
  '00000000-0000-0000-0000-000000000a72',(now() at time zone 'America/Chicago')::date,8),
 ('00000000-0000-0000-0000-000000000a82','00000000-0000-0000-0000-0000000000a8',
  '00000000-0000-0000-0000-000000000a81',(now() at time zone 'America/Chicago')::date,0);

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a7',false);
set role authenticated;
do $$
declare
 r public.log_quest_progress%rowtype;
 receipt jsonb;
begin
 -- Increment-2 quests must clear arbitrary accumulated 7/8 to zero atomically.
 select * into r from public.log_quest_progress(
   '00000000-0000-0000-0000-000000000a73',
   '00000000-0000-0000-0000-000000000b01',7);
 if r.current_amount <> 7 or r.completed_now then raise exception 'Combined 7/8 setup failed'; end if;
 select * into r from public.log_quest_progress(
   '00000000-0000-0000-0000-000000000a73',
   '00000000-0000-0000-0000-000000000b02',-7);
 if r.current_amount <> 0 or r.completed_now then raise exception 'Combined 7-to-0 clear failed'; end if;
 select * into r from public.log_quest_progress(
   '00000000-0000-0000-0000-000000000a73',
   '00000000-0000-0000-0000-000000000b02',-7);
 if r.current_amount <> 0 or r.completed_now then raise exception 'Combined clear replay failed'; end if;
 if (select count(*) from public.quest_progress_operations
     where instance_id='00000000-0000-0000-0000-000000000a73') <> 2
    or exists(select 1 from public.xp_ledger
      where instance_id='00000000-0000-0000-0000-000000000a73') then
   raise exception 'Clear replay duplicated journal or awarded partial XP';
 end if;

 select * into r from public.log_quest_progress(
   '00000000-0000-0000-0000-000000000a73',
   '00000000-0000-0000-0000-000000000b03',2);
 if r.current_amount <> 2 then raise exception 'Combined 2/8 setup failed'; end if;
 begin
   perform public.set_quest_instance_status_v2('00000000-0000-0000-0000-000000000a73','complete');
   raise exception 'Combined v2 accepted incomplete tracked quest';
 exception when others then
   if sqlerrm <> 'Tracked quest has not reached its target' then raise; end if;
 end;
 if (select status from public.quest_instances
     where id='00000000-0000-0000-0000-000000000a73') <> 'available'
    or exists(select 1 from public.quest_events
      where instance_id='00000000-0000-0000-0000-000000000a73')
    or exists(select 1 from public.xp_ledger
      where instance_id='00000000-0000-0000-0000-000000000a73') then
   raise exception 'Rejected 2/8 completion mutated status/event/ledger';
 end if;

 -- Reaching 8/8 via authoritative progress RPC auto-completes; v2 retry adds no XP.
 select * into r from public.log_quest_progress(
   '00000000-0000-0000-0000-000000000a73',
   '00000000-0000-0000-0000-000000000b04',6);
 if r.current_amount <> 8 or r.status <> 'completed' or not r.completed_now then
   raise exception 'Combined 8/8 progress completion failed';
 end if;
 receipt := public.set_quest_instance_status_v2('00000000-0000-0000-0000-000000000a73','complete');
 if receipt->>'reward_status' <> 'already_awarded'
    or receipt->>'xp_awarded' <> '0'
    or receipt->>'reward_confirmed' <> 'true'
    or (select count(*) from public.xp_ledger
        where instance_id='00000000-0000-0000-0000-000000000a73') <> 1 then
   raise exception 'Combined legacy-to-v2 retry minted duplicate XP: %',receipt;
 end if;

 -- V2 fresh completion at 8/8 must award exactly once.
 receipt := public.set_quest_instance_status_v2('00000000-0000-0000-0000-000000000a74','complete');
 if receipt->>'reward_status' <> 'awarded' or receipt->>'xp_awarded' <> '1' then
   raise exception 'Combined v2 initial award invalid: %',receipt;
 end if;
 receipt := public.set_quest_instance_status_v2('00000000-0000-0000-0000-000000000a74','complete');
 if receipt->>'reward_status' <> 'already_awarded' or receipt->>'xp_awarded' <> '0'
    or (select count(*) from public.xp_ledger
        where instance_id='00000000-0000-0000-0000-000000000a74') <> 1
    or (select count(*) from public.quest_events
        where instance_id='00000000-0000-0000-0000-000000000a74'
          and event_type='completed') <> 1 then
   raise exception 'Combined v2 retry duplicated event or XP: %',receipt;
 end if;
 raise notice 'PASS combined clear/replay, 2/8 rejection, 8/8 once, legacy-v2 parity';
end $$;
reset role;

-- User B must have a real journal record before reciprocal RLS assertions.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a8',false);
set role authenticated;
select * from public.log_quest_progress(
 '00000000-0000-0000-0000-000000000a82',
 '00000000-0000-0000-0000-000000000b81',1);
do $$
begin
 if not exists(select 1 from public.quest_progress_operations
   where owner_id='00000000-0000-0000-0000-0000000000a8')
   or exists(select 1 from public.quest_progress_operations
   where owner_id='00000000-0000-0000-0000-0000000000a7') then
   raise exception 'Owner B journal RLS failed or fixture vacuous';
 end if;
 begin
   perform public.set_quest_instance_status_v2(
     '00000000-0000-0000-0000-000000000a74','complete');
   raise exception 'Cross-owner v2 completion accepted';
 exception when others then
   if sqlerrm <> 'Instance not found' then raise; end if;
 end;
end $$;
reset role;

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a7',false);
set role authenticated;
do $$
begin
 if not exists(select 1 from public.quest_progress_operations
   where owner_id='00000000-0000-0000-0000-0000000000a7')
   or exists(select 1 from public.quest_progress_operations
   where owner_id='00000000-0000-0000-0000-0000000000a8') then
   raise exception 'Owner A journal RLS failed or fixture vacuous';
 end if;
 begin
   perform public.log_quest_progress(
     '00000000-0000-0000-0000-000000000a82',
     '00000000-0000-0000-0000-000000000b82',1);
   raise exception 'Cross-owner progress mutation accepted';
 exception when others then
   if sqlerrm <> 'Quest not found' then raise; end if;
 end;
 begin
   update public.quest_progress_operations set delta=9
     where owner_id='00000000-0000-0000-0000-0000000000a7';
   raise exception 'Direct authenticated journal UPDATE permitted';
 exception when insufficient_privilege then null;
 end;
 raise notice 'PASS combined nonempty two-owner RLS, cross-owner denial';
end $$;
reset role;
