-- Isolated-only companion assignment / XP smoke tests.
begin;
insert into auth.users(id) values
 ('a0000000-0000-4000-8000-000000000101'),
 ('a0000000-0000-4000-8000-000000000102');
set local role authenticated;
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000101',true);
-- Simulate confirmed consent; no companion account is created.
insert into public.quest_companions(id,owner_id,display_name,consent_confirmed_at)
values('b0000000-0000-4000-8000-000000000101','a0000000-0000-4000-8000-000000000101','Test Companion',now());
-- The real assignment RPC deduplicates an existing quest.
insert into public.quests(id,owner_id,title,domain,cadence)
values('c0000000-0000-4000-8000-000000000101','a0000000-0000-4000-8000-000000000101','Fold Laundry','home','daily');
do $$
declare v_quest uuid; v_instance uuid; v_xp int; v_count int;
begin
 v_quest:=public.quest_companion_assign_to_owner('b0000000-0000-4000-8000-000000000101',' fold   laundry ');
 if v_quest <> 'c0000000-0000-4000-8000-000000000101'::uuid then raise exception 'Failed to deduplicate existing quest'; end if;
 v_quest:=public.quest_companion_assign_to_owner('b0000000-0000-4000-8000-000000000101','Fold Laundry');
 select count(*) into v_count from public.quest_companion_assignments where quest_id=v_quest;
 if v_count<>1 then raise exception 'Duplicate assignment inserted'; end if;
 v_instance:=public.ensure_quest_instance(v_quest,current_date);
 perform public.set_quest_instance_status(v_instance,'complete');
 perform public.set_quest_instance_status(v_instance,'complete');
 select amount into v_xp from public.xp_ledger where instance_id=v_instance;
 if v_xp<>1 then raise exception 'Companion quests still award exactly 1 XP, got %',v_xp; end if;
 select count(*) into v_count from public.xp_ledger where instance_id=v_instance;
 if v_count<>1 then raise exception 'Duplicate XP ledger row'; end if;
end $$;
-- Bulk instance creation must be idempotent and scoped to the owner.
do $bulk$
declare v_before integer; v_after integer; v_first integer; v_second integer;
begin
 select count(*) into v_before from public.quest_instances where owner_id=auth.uid();
 select public.quest_board_v3_ensure_instances(((now()-interval '5 hours') at time zone 'America/Chicago')::date) into v_first;
 select public.quest_board_v3_ensure_instances(((now()-interval '5 hours') at time zone 'America/Chicago')::date) into v_second;
 if v_first<>v_second or v_first<1 then raise exception 'Bulk ensure returned inconsistent count'; end if;
 select count(*) into v_after from public.quest_instances where owner_id=auth.uid();
 if v_after < v_before then raise exception 'Bulk ensure removed instances'; end if;
 begin
  perform public.quest_board_v3_ensure_instances('2000-01-01'::date);
  raise exception 'Invalid bulk day unexpectedly accepted';
 exception when raise_exception then
  if sqlerrm='Invalid bulk day unexpectedly accepted' then raise; end if;
 end;
end $bulk$;
-- Normal quest still awards exactly 1 XP.
insert into public.quests(id,owner_id,title,domain,cadence)
values('c0000000-0000-4000-8000-000000000102','a0000000-0000-4000-8000-000000000101','Brush Teeth','hygiene','daily');
do $$
declare v_instance uuid; v_xp int;
begin
 v_instance:=public.ensure_quest_instance('c0000000-0000-4000-8000-000000000102',current_date);
 perform public.set_quest_instance_status(v_instance,'complete');
 select amount into v_xp from public.xp_ledger where instance_id=v_instance;
 if v_xp<>1 then raise exception 'Normal quest expected 1 XP, got %',v_xp; end if;
end $$;
-- Assigning an already-completed quest must not retroactively change its 1 XP.
insert into public.quests(id,owner_id,title,domain,cadence)
values('c0000000-0000-4000-8000-000000000103','a0000000-0000-4000-8000-000000000101','Wash Dishes','home','daily');
do $audit$
declare v_instance uuid; v_quest uuid; v_xp int;
begin
 v_instance:=public.ensure_quest_instance('c0000000-0000-4000-8000-000000000103',current_date);
 perform public.set_quest_instance_status(v_instance,'complete');
 v_quest:=public.quest_companion_assign_to_owner('b0000000-0000-4000-8000-000000000101','Wash Dishes');
 if v_quest<>'c0000000-0000-4000-8000-000000000103'::uuid then raise exception 'Failed to reuse completed quest'; end if;
 select amount into v_xp from public.xp_ledger where instance_id=v_instance;
 if v_xp<>1 then raise exception 'Historical XP was modified'; end if;
end $audit$;
-- Retiring an assignment changes future XP, not the existing ledger.
do $retire$
declare v_assignment uuid; v_instance uuid; v_xp int;
begin
 select id into v_assignment from public.quest_companion_assignments
 where quest_id='c0000000-0000-4000-8000-000000000101'::uuid;
 if not public.quest_companion_retire_assignment(v_assignment) then raise exception 'Retirement failed'; end if;
 if public.quest_companion_retire_assignment(v_assignment) then raise exception 'Repeated retirement should be idempotent'; end if;
 v_instance:=public.ensure_quest_instance('c0000000-0000-4000-8000-000000000101'::uuid,current_date+1);
 perform public.set_quest_instance_status(v_instance,'complete');
 select amount into v_xp from public.xp_ledger where instance_id=v_instance;
 if v_xp<>1 then raise exception 'Retired assignment should award 1 XP'; end if;
end $retire$;
-- Another owner cannot assign the companion.
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000102',true);
do $$
begin
 begin
  perform public.quest_companion_assign_to_owner('b0000000-0000-4000-8000-000000000101','Unauthorized task');
  raise exception 'Cross-owner assignment unexpectedly succeeded';
 exception when raise_exception then
  if sqlerrm='Cross-owner assignment unexpectedly succeeded' then raise; end if;
 end;
end $$;
-- Bulk instance creation must never include another owner's quests.
do $bulk_isolation$
declare v_count integer;
begin
 select public.quest_board_v3_ensure_instances(((now()-interval '5 hours') at time zone 'America/Chicago')::date) into v_count;
 if v_count<>0 then raise exception 'Cross-owner bulk ensure returned % quests',v_count; end if;
 if exists(select 1 from public.quest_instances where owner_id=auth.uid()) then
  raise exception 'Cross-owner bulk ensure created an instance';
 end if;
end $bulk_isolation$;
-- Cross-owner retirement must not alter the original owner's assignment.
do $unauthorized_retire$
declare v_assignment uuid;
begin
 select id into v_assignment from public.quest_companion_assignments
 where quest_id='c0000000-0000-4000-8000-000000000103'::uuid;
 if public.quest_companion_retire_assignment(v_assignment) then
  raise exception 'Cross-owner retirement unexpectedly succeeded';
 end if;
 if not exists(select 1 from public.quest_companion_assignments where id=v_assignment and active) then
  raise exception 'Cross-owner retirement changed the assignment';
 end if;
end $unauthorized_retire$;
rollback;
