-- Runs after migrations 0001-0012 on disposable Postgres only.
insert into auth.users(id) values
 ('00000000-0000-0000-0000-0000000000b1'),
 ('00000000-0000-0000-0000-0000000000b2');
insert into public.quests(id,owner_id,title,domain,cadence,target_amount,progress_unit,progress_increment)
values
 ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000b1','Drink water','physical_health','daily',8,'glasses',1),
 ('00000000-0000-0000-0000-0000000000c2','00000000-0000-0000-0000-0000000000b2','Other user water','physical_health','daily',8,'glasses',1);
insert into public.quest_instances(id,owner_id,quest_id,due_date)
values
 ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000c1',(now() at time zone 'America/Chicago')::date),
 ('00000000-0000-0000-0000-0000000000d2','00000000-0000-0000-0000-0000000000b2','00000000-0000-0000-0000-0000000000c2',(now() at time zone 'America/Chicago')::date);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000b1',false);
set role authenticated;
do $$
declare r record; n integer;
begin
 begin
   perform public.set_quest_instance_status('00000000-0000-0000-0000-0000000000d1','complete');
   raise exception 'Direct completion bypass accepted';
 exception when others then
   if sqlerrm <> 'Tracked quest has not reached its target' then raise; end if;
 end;
 -- Invalid atomic creation must not leave behind an untracked quest.
 begin
   perform public.create_tracked_quest('Atomic rollback probe','home','daily',
     (now() at time zone 'America/Chicago')::date,'scheduled',8,'glasses',9);
   raise exception 'Invalid atomic creation accepted';
 exception when others then
   if sqlerrm <> 'Invalid progress configuration' then raise; end if;
 end;
 if exists(select 1 from public.quests where title='Atomic rollback probe') then
   raise exception 'Invalid tracked quest was partially created';
 end if;
 -- Valid tracked creation must persist target and increment together.
 perform public.create_tracked_quest('Atomic creation probe','home','daily',
   (now() at time zone 'America/Chicago')::date,'scheduled',8,'glasses',1);
 if (select count(*) from public.quests where title='Atomic creation probe'
      and owner_id='00000000-0000-0000-0000-0000000000b1'
      and target_amount=8 and progress_increment=1) <> 1 then
   raise exception 'Tracked quest was not atomically configured';
 end if;
 -- A different user must not reconfigure this quest or inspect its operation journal.
 begin
   perform public.configure_quest_progress('00000000-0000-0000-0000-0000000000c2',8,'glasses',1);
   raise exception 'Cross-user configuration accepted';
 exception when others then
   if sqlerrm <> 'Active quest not found' then raise; end if;
 end;
 if exists(select 1 from public.quest_progress_operations
           where owner_id='00000000-0000-0000-0000-0000000000b2') then
   raise exception 'Other user operation leaked';
 end if;
 select * into r from public.log_quest_progress('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000e1',1);
 if r.current_amount <> 1 or r.status <> 'available' then raise exception 'First increment failed'; end if;
 -- Configuration cannot shrink or otherwise change while an instance has progress.
 begin
   perform public.configure_quest_progress('00000000-0000-0000-0000-0000000000c1',3,'glasses',1);
   raise exception 'Reconfiguration after progress accepted';
 exception when others then
   if sqlerrm <> 'Quest already has completion or progress history' then raise; end if;
 end;
 if (select target_amount from public.quests where id='00000000-0000-0000-0000-0000000000c1') <> 8 then
   raise exception 'Target changed despite progress history';
 end if;
 select * into r from public.log_quest_progress('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000e1',1);
 if r.current_amount <> 1 or r.completed_now then raise exception 'Retry double-counted or replayed completion'; end if;
 begin
   perform public.log_quest_progress('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000e1',2);
   raise exception 'Changed payload accepted';
 exception when others then
   if sqlerrm <> 'Request ID reused with different payload' then raise; end if;
 end;
 begin
   perform public.log_quest_progress('00000000-0000-0000-0000-0000000000d2','00000000-0000-0000-0000-0000000000e2',1);
   raise exception 'Cross-user progress accepted';
 exception when others then
   if sqlerrm <> 'Quest not found' then raise; end if;
 end;
 select * into r from public.log_quest_progress('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000e3',-1);
 if r.current_amount <> 0 then raise exception 'Undo failed'; end if;
 for n in 1..8 loop
   select * into r from public.log_quest_progress('00000000-0000-0000-0000-0000000000d1',
     ('00000000-0000-0000-0000-' || lpad(to_hex(60000+n),12,'0'))::uuid,1);
 end loop;
 if r.current_amount <> 8 or r.status <> 'completed' then raise exception 'Target completion failed'; end if;
 select * into r from public.log_quest_progress('00000000-0000-0000-0000-0000000000d1',
     ('00000000-0000-0000-0000-' || lpad(to_hex(60008),12,'0'))::uuid,1);
 if r.current_amount <> 8 or r.completed_now then raise exception 'Completion retry changed result or replayed animation'; end if;
 if (select count(*) from public.xp_ledger where instance_id='00000000-0000-0000-0000-0000000000d1') <> 1
    or (select sum(amount) from public.xp_ledger where instance_id='00000000-0000-0000-0000-0000000000d1') <> 1
 then raise exception 'XP was not awarded exactly once'; end if;
 if (select count(*) from public.quest_events where instance_id='00000000-0000-0000-0000-0000000000d1' and event_type='completed') <> 1
 then raise exception 'Completion event was duplicated'; end if;
 raise notice 'PASS progress, idempotency, undo, cross-user isolation, single XP award';
end $$;
reset role;
-- API-key service-role wrapper must also respect the target guard.
select set_config('request.jwt.claim.role','service_role',false);
select set_config('request.jwt.claim.sub','',false);
set role service_role;
do $$
begin
 begin
   perform public.set_quest_instance_status_as_user(
     '00000000-0000-0000-0000-0000000000b2',
     '00000000-0000-0000-0000-0000000000d2',
     'complete'
   );
   raise exception 'API-key completion bypass accepted';
 exception when others then
   if sqlerrm <> 'Tracked quest has not reached its target' then raise; end if;
 end;
 -- API-key wrapper may log its authenticated owner's partial progress.
 perform public.log_quest_progress_as_user(
   '00000000-0000-0000-0000-0000000000b2',
   '00000000-0000-0000-0000-0000000000d2',
   '00000000-0000-0000-0000-0000000000e9',1);
 perform public.log_quest_progress_as_user(
   '00000000-0000-0000-0000-0000000000b2',
   '00000000-0000-0000-0000-0000000000d2',
   '00000000-0000-0000-0000-0000000000e9',1);
 begin
   perform public.log_quest_progress_as_user(
     '00000000-0000-0000-0000-0000000000b1',
     '00000000-0000-0000-0000-0000000000d2',
     '00000000-0000-0000-0000-0000000000ea',1);
   raise exception 'Cross-user API-key progress accepted';
 exception when others then
   if sqlerrm <> 'Quest not found' then raise; end if;
 end;
 raise notice 'PASS service-role wrapper cannot bypass progress target';
end $$;
reset role;

-- Verify ledger as migration-test owner; service_role lacks explicit SELECT in the isolated harness.
reset role;
do $$
begin
 if (select current_amount from public.quest_instances where id='00000000-0000-0000-0000-0000000000d2') <> 1 then
   raise exception 'API-key retry duplicated progress';
 end if;
 if exists(select 1 from public.xp_ledger where instance_id='00000000-0000-0000-0000-0000000000d2') then
   raise exception 'API-key wrapper awarded XP prematurely';
 end if;
 raise notice 'PASS API-key rejection left XP ledger untouched';
end $$;
