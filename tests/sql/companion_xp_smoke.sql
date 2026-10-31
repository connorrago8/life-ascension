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
 if v_xp<>2 then raise exception 'Expected exactly 2 XP, got %',v_xp; end if;
 select count(*) into v_count from public.xp_ledger where instance_id=v_instance;
 if v_count<>1 then raise exception 'Duplicate XP ledger row'; end if;
end $$;
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
rollback;
