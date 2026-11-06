-- QA-only isolated database fixture. Only replace clock calls; ROLLBACK restores originals.
begin;
do $$declare signature text; definition text;
begin
 foreach signature in array array['public.create_scheduled_quest(text,text,text,date,text)','public.ensure_quest_instance(uuid,date)','public.set_quest_instance_status(uuid,text)'] loop
  definition:=pg_get_functiondef(signature::regprocedure);
  if position('now()' in definition)=0 then raise exception 'Fixture could not find clock call in %',signature;end if;
  execute replace(definition,'now()','timestamptz ''2026-11-06T06:30:00Z''');
 end loop;
end$$;
create temporary table qa_contract_results(label text,passed boolean,observed jsonb);
grant select,insert on qa_contract_results to authenticated;
insert into auth.users(id) values('00000000-0000-0000-0000-00000000fa01'),('00000000-0000-0000-0000-00000000fa02');
insert into public.quests(id,owner_id,title,domain,cadence,scheduled_for,quest_type) values
 ('00000000-0000-0000-0000-00000000fa10','00000000-0000-0000-0000-00000000fa01','QA daily eligible task','home','daily','2026-11-01','scheduled'),
 ('00000000-0000-0000-0000-00000000fa20','00000000-0000-0000-0000-00000000fa02','Other account private daily','home','daily','2026-11-01','scheduled');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000fa01',true);
do $$declare previous_id uuid; future_id uuid; rejected boolean:=false; cross_user_rejected boolean:=false;
 day date:=(timestamptz '2026-11-06T06:30:00Z' at time zone 'America/Chicago' - interval '5 hours')::date;
 total integer; events integer;
begin
 previous_id:=public.ensure_quest_instance('00000000-0000-0000-0000-00000000fa10',day);
 perform public.set_quest_instance_status(previous_id,'complete');
 perform public.set_quest_instance_status(previous_id,'complete');
 select coalesce(sum(amount),0) into total from public.xp_ledger where instance_id=previous_id;
 select count(*) into events from public.quest_events where instance_id=previous_id and event_type='completed';
 insert into qa_contract_results values('eligible previous quest day completes once',total=1 and events=1,jsonb_build_object('questDay',day,'xp',total,'events',events));
 future_id:=public.ensure_quest_instance('00000000-0000-0000-0000-00000000fa10',day+1);
 begin perform public.set_quest_instance_status(future_id,'complete');exception when sqlstate 'P0001' then rejected:=true;end;
 select coalesce(sum(amount),0) into total from public.xp_ledger where instance_id=future_id;
 insert into qa_contract_results values('next quest day cannot credit before05:00',rejected and total=0,jsonb_build_object('fixtureInstant','2026-11-06T06:30:00Z','chicagoTime','2026-11-06 00:30 CST','eligibleQuestDay',day,'attemptedDay',day+1,'rejected',rejected,'earlyXp',total));
 begin perform public.ensure_quest_instance('00000000-0000-0000-0000-00000000fa20',day);exception when sqlstate 'P0001' then cross_user_rejected:=true;end;
 insert into qa_contract_results values('other owner instance creation denied',cross_user_rejected,jsonb_build_object('rejected',cross_user_rejected));
 insert into qa_contract_results select 'other owner quest hidden by RLS',count(*)=0,jsonb_build_object('visibleOtherRows',count(*)) from public.quests where id='00000000-0000-0000-0000-00000000fa20';
 insert into qa_contract_results values('direct ledger writes denied',not has_table_privilege('authenticated','public.xp_ledger','insert'),jsonb_build_object('canInsert',has_table_privilege('authenticated','public.xp_ledger','insert')));
end$$;
reset role;
insert into qa_contract_results values('anonymous completion denied',not has_function_privilege('anon','public.set_quest_instance_status(uuid,text)','execute'),jsonb_build_object('canExecute',has_function_privilege('anon','public.set_quest_instance_status(uuid,text)','execute')));
select jsonb_build_object('case',label,'pass',passed,'observed',observed) from qa_contract_results order by label;
do $$begin if exists(select 1 from qa_contract_results where passed is distinct from true) then raise exception 'QA contract failure: next-day daily XP must wait until05:00 Chicago';end if;end$$;
rollback;
