-- Disposable local database only. Self-log cannot assign XP to another account.
\set ON_ERROR_STOP on
insert into auth.users(id) values
 ('00000000-0000-0000-0000-00000000c430'),
 ('00000000-0000-0000-0000-00000000c431'),
 ('00000000-0000-0000-0000-00000000c432');
insert into public.companion_bonds(id,inviter_id,companion_id,status,token_hash,expires_at,accepted_at)
 values('00000000-0000-0000-0000-00000000c4b3','00000000-0000-0000-0000-00000000c430','00000000-0000-0000-0000-00000000c431','active','self-log-smoke',now()+interval '1 day',now());
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000c431',false);
do $$ declare r jsonb; begin
 r:=public.companion_log_activity_v2('00000000-0000-0000-0000-00000000c43a','Make the bed',null,'small',null);
 assert (r->>'xpAwarded')::int=5,r::text;
 r:=public.companion_log_activity_v2('00000000-0000-0000-0000-00000000c43a','Make the bed',null,'small',null);
 assert (r->>'already')::boolean and (r->>'xpAwarded')::int=0,'self retry awards once';
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000c430',false);
do $$ declare r jsonb; begin
 r:=public.companion_log_activity_v2('00000000-0000-0000-0000-00000000c43b','Make the bed',null,'small',null);
 assert (r->>'already')::boolean and (r->>'xpAwarded')::int=0,'cross-partner duplicate awards once';
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000c432',false);
do $$ begin
 begin
  perform public.companion_log_activity_v2(gen_random_uuid(),'Make the bed',null,'small',null);
  raise exception 'Outsider accepted';
 exception when raise_exception then assert sqlerrm='Companion connection required',sqlerrm; end;
end $$;
reset role;
do $$ begin
 assert (select count(*) from public.companion_activities where subject_id='00000000-0000-0000-0000-00000000c431')=1;
 assert (select xp_awarded=5 and recorded_by=subject_id from public.companion_activities where subject_id='00000000-0000-0000-0000-00000000c431');
 assert not exists(select 1 from public.xp_ledger where owner_id in ('00000000-0000-0000-0000-00000000c430','00000000-0000-0000-0000-00000000c431')),'no normal-quest XP or streak from activities';
end $$;
insert into public.companion_xp_ledger(owner_id,bond_id,amount,source_key,reason)
values('00000000-0000-0000-0000-00000000c431','00000000-0000-0000-0000-00000000c4b3',10,'self-log-couple-award','couple_quest');
do $$ begin
 assert public._companion_lifetime_xp('00000000-0000-0000-0000-00000000c431')=15,'activity plus couple award levels companion';
 assert public._companion_lifetime_xp('00000000-0000-0000-0000-00000000c430')=0,'no partner XP leakage';
end $$;
select 'companion self log smoke passed' as result;
