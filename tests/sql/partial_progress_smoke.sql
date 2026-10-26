-- Runs after migrations 0001-0008 on disposable Postgres only.
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
 select * into r from public.log_quest_progress('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000e1',1);
 if r.current_amount <> 1 or r.status <> 'available' then raise exception 'First increment failed'; end if;
 select * into r from public.log_quest_progress('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000e1',1);
 if r.current_amount <> 1 then raise exception 'Retry double-counted'; end if;
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
   if sqlerrm <> 'Instance not found' then raise; end if;
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
 if r.current_amount <> 8 then raise exception 'Completion retry changed result'; end if;
 if (select count(*) from public.xp_ledger where instance_id='00000000-0000-0000-0000-0000000000d1') <> 1
    or (select sum(amount) from public.xp_ledger where instance_id='00000000-0000-0000-0000-0000000000d1') <> 1
 then raise exception 'XP was not awarded exactly once'; end if;
 if (select count(*) from public.quest_events where instance_id='00000000-0000-0000-0000-0000000000d1' and event_type='completed') <> 1
 then raise exception 'Completion event was duplicated'; end if;
 raise notice 'PASS progress, idempotency, undo, cross-user isolation, single XP award';
end $$;
reset role;
