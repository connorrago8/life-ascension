-- Three synthetic accounts in isolated PostgreSQL. No hosted users or data.
create temporary table companion_fixture(label text primary key,value jsonb);
grant select,insert,update on companion_fixture to authenticated;
create function public.test_companion_assert(ok boolean,message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'ASSERT: %',message; end if; end $$;
create function public.test_companion_reject(action text,payload jsonb,message text) returns void language plpgsql as $$
begin
 begin perform public.companion_command(action,payload);
 exception when others then if sqlerrm=message then return; else raise; end if; end;
 raise exception 'Expected rejection: %',message;
end $$;
insert into auth.users(id) values
 ('00000000-0000-0000-0000-00000000ca01'),('00000000-0000-0000-0000-00000000ca02'),('00000000-0000-0000-0000-00000000ca03');
insert into public.profiles(id,display_name) values
 ('00000000-0000-0000-0000-00000000ca01','Connor fixture'),('00000000-0000-0000-0000-00000000ca02','Izzy fixture'),('00000000-0000-0000-0000-00000000ca03','Unrelated fixture');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000ca01',false);
set role authenticated;
insert into companion_fixture values('invitation',public.companion_command('invite','{"role":"recipient"}'));
select public.test_companion_assert((select length(value->>'inviteCode')=64 from companion_fixture where label='invitation'),'unguessable invitation code');
select public.test_companion_reject('join',jsonb_build_object('code',(select value->>'inviteCode' from companion_fixture where label='invitation')),'Invitation unavailable');
insert into companion_fixture values('pair',jsonb_build_object('id',(public.companion_command('dashboard')->'pairs'->0->>'id')));
select public.test_companion_assert((public.companion_command('dashboard')->'quests')='[]','no auto-assignment');
-- A legitimate personal completion before the offer will be upgraded, never credited twice.
do $$ declare q uuid; i uuid; d date:=(now() at time zone 'America/Chicago' - interval '5 hours')::date;
begin
 q:=public.create_scheduled_quest('Brush teeth','hygiene','daily',d,'scheduled');
 i:=public.ensure_quest_instance(q,d); perform public.set_quest_instance_status(i,'complete');
 insert into companion_fixture values('personal',jsonb_build_object('instance',i,'quest',q));
 if public.get_lifetime_xp()<>1 then raise exception 'ordinary quest did not award exactly1'; end if;
end $$;

reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000ca02',false);
set role authenticated;
select public.test_companion_assert((select count(*)=0 from public.companion_pairs),'other account cannot enumerate pending invites');
select public.test_companion_assert(public.companion_command('preview-invite',jsonb_build_object('code',(select value->>'inviteCode' from companion_fixture where label='invitation')))->>'yourRole'='sender','explicit previewed role');
select public.companion_command('join',jsonb_build_object('code',(select value->>'inviteCode' from companion_fixture where label='invitation')));
select public.companion_command('join',jsonb_build_object('code',(select value->>'inviteCode' from companion_fixture where label='invitation')));
select public.test_companion_reject('confirm',jsonb_build_object('pairId',(select value->>'id' from companion_fixture where label='pair')),'Invitation unavailable');
select public.test_companion_reject('send',jsonb_build_object('pairId',(select value->>'id' from companion_fixture where label='pair')),'Companionship unavailable');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000ca01',false);
set role authenticated;
select public.companion_command('confirm',jsonb_build_object('pairId',(select value->>'id' from companion_fixture where label='pair')));
select public.companion_command('confirm',jsonb_build_object('pairId',(select value->>'id' from companion_fixture where label='pair')));
select public.test_companion_reject('send',jsonb_build_object('pairId',(select value->>'id' from companion_fixture where label='pair')),'Only the agreed sender can assign quests');

reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000ca02',false);
set role authenticated;
insert into companion_fixture values('offerPayload',jsonb_build_object('pairId',(select value->>'id' from companion_fixture where label='pair'),
 'recipientId','00000000-0000-0000-0000-00000000ca03','senderId','00000000-0000-0000-0000-00000000ca03','xp',999,
 'requestId','00000000-0000-0000-0000-00000000cb01','title','Brush teeth','category','hygiene','difficulty','Gentle','mystery',true,'reward','SECRET picnic promise'));
insert into companion_fixture values('offer',public.companion_command('send',(select value from companion_fixture where label='offerPayload')));
select public.test_companion_assert(public.companion_command('send',(select value from companion_fixture where label='offerPayload'))=(select value from companion_fixture where label='offer'),'retry sends same offer');
select public.test_companion_assert((select count(*)=1 from public.companion_quests),'send retry creates no duplicate');
select public.test_companion_assert((select recipient_id='00000000-0000-0000-0000-00000000ca01' and sender_id=auth.uid() from public.companion_quests),'client actor/recipient/XP overrides ignored');
select public.test_companion_reject('send',(select value||'{"title":"Changed title"}'::jsonb from companion_fixture where label='offerPayload'),'This send attempt already exists; refresh before editing');
select public.test_companion_assert(public.companion_command('dashboard')::text like '%SECRET picnic promise%','sender can review own promise');
select public.test_companion_reject('accept',jsonb_build_object('questId',(select value->>'questId' from companion_fixture where label='offer')),'Quest unavailable');
select public.test_companion_reject('complete',jsonb_build_object('questId',(select value->>'questId' from companion_fixture where label='offer')),'Quest unavailable');
select public.test_companion_reject('rain-check',jsonb_build_object('questId',(select value->>'questId' from companion_fixture where label='offer'),'until','2026-12-01'),'Quest unavailable');

reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000ca03',false);
set role authenticated;
select public.test_companion_assert((select count(*)=0 from public.companion_quests),'RLS hides unrelated shared quests');
select public.test_companion_assert((select count(*)=0 from public.companion_pairs),'RLS hides unrelated pair');
select public.test_companion_assert(public.companion_command('dashboard')->'quests'='[]','RPC hides unrelated quests');
select public.test_companion_reject('accept',jsonb_build_object('questId',(select value->>'questId' from companion_fixture where label='offer')),'Quest unavailable');
select public.test_companion_reject('revoke',jsonb_build_object('pairId',(select value->>'id' from companion_fixture where label='pair')),'Companionship unavailable');
select public.test_companion_reject('join',jsonb_build_object('code',(select value->>'inviteCode' from companion_fixture where label='invitation')),'Invitation unavailable');

reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000ca01',false);
set role authenticated;
select public.test_companion_assert(public.companion_command('dashboard')::text not like '%SECRET picnic promise%','mystery not present anywhere in pending recipient payload');
select public.test_companion_assert((public.companion_command('dashboard')->'quests'->0->'reward')='null'::jsonb,'pending reward is null');
select public.test_companion_reject('complete',jsonb_build_object('questId',(select value->>'questId' from companion_fixture where label='offer')),'Accept this quest first');
do $$ begin
 begin perform promise from companion_private.quest_rewards; raise exception 'private reward SELECT succeeded';
 exception when insufficient_privilege then null; end;
 begin update public.companion_quests set status='accepted'; raise exception 'direct quest UPDATE succeeded';
 exception when insufficient_privilege then null; end;
 begin insert into public.xp_ledger(owner_id,instance_id,amount) values(auth.uid(),(select (value->>'instance')::uuid from companion_fixture where label='personal'),2);
  raise exception 'direct XP INSERT succeeded'; exception when insufficient_privilege then null; end;
end $$;
select public.companion_command('accept',jsonb_build_object('questId',(select value->>'questId' from companion_fixture where label='offer')));
select public.companion_command('accept',jsonb_build_object('questId',(select value->>'questId' from companion_fixture where label='offer')));
select public.test_companion_assert(public.companion_command('dashboard')::text like '%SECRET picnic promise%','reward revealed only after acceptance');
select public.test_companion_assert((select instance_id=(select (value->>'instance')::uuid from companion_fixture where label='personal') from public.companion_quests),'exact-title overlap reuses original instance');
select public.companion_command('complete',jsonb_build_object('questId',(select value->>'questId' from companion_fixture where label='offer')));
select public.companion_command('complete',jsonb_build_object('questId',(select value->>'questId' from companion_fixture where label='offer')));
select public.test_companion_assert(public.get_lifetime_xp()=2,'overlap is2total, not1+2 or duplicate');
select public.test_companion_assert((select count(*)=1 from public.xp_ledger),'one ledger row');
select public.test_companion_assert((select count(*)=1 from public.quest_events where event_type='completed'),'one completion event');
-- Reload is a fresh RPC; actor totals remain separate.
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000ca02',false);
set role authenticated;
select public.test_companion_assert(public.get_lifetime_xp()=0,'Izzy did not inherit Connor XP');
select public.test_companion_assert((select count(*)=0 from public.quest_instances),'shared status grants no access to recipient private instances');
select public.test_companion_assert(public.companion_command('dashboard')->'quests'->0->>'status'='completed','sender can see agreed shared completion');
insert into companion_fixture values('second',public.companion_command('send',jsonb_build_object('pairId',(select value->>'id' from companion_fixture where label='pair'),
 'requestId','00000000-0000-0000-0000-00000000cb02','title','Take a walk','category','physical_health','reward','Visible tea promise')));
insert into companion_fixture values('decline',public.companion_command('send',jsonb_build_object('pairId',(select value->>'id' from companion_fixture where label='pair'),
 'requestId','00000000-0000-0000-0000-00000000cb03','title','Optional tidy','mystery',true,'reward','SECRET declined promise')));
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000ca01',false);
set role authenticated;
select public.test_companion_assert(public.companion_command('dashboard')::text like '%Visible tea promise%','non-mystery visible before acceptance');
select public.companion_command('decline',jsonb_build_object('questId',(select value->>'questId' from companion_fixture where label='decline')));
select public.companion_command('decline',jsonb_build_object('questId',(select value->>'questId' from companion_fixture where label='decline')));
select public.test_companion_assert(public.companion_command('dashboard')::text not like '%SECRET declined promise%','decline never reveals mystery');
select public.companion_command('accept',jsonb_build_object('questId',(select value->>'questId' from companion_fixture where label='second')));
select public.companion_command('rain-check',jsonb_build_object('questId',(select value->>'questId' from companion_fixture where label='second'),'until',((now() at time zone 'America/Chicago')::date+1)::text));
select public.test_companion_assert(public.get_lifetime_xp()=2,'rain check/decline has no penalty or bonus');
select public.companion_command('complete',jsonb_build_object('questId',(select value->>'questId' from companion_fixture where label='second')));
select public.test_companion_assert(public.get_lifetime_xp()=4,'new completed quest earns2 exactly once');
-- Future-deadline goals and uninstantiated/off-board habits reuse the original task.
do $$ declare d date:=(now() at time zone 'America/Chicago' - interval '5 hours')::date; goal uuid;
begin
 goal:=public.create_scheduled_quest('Plan a trip','personal_growth','once',d+7,'goal');
 insert into companion_fixture values('futureGoal',jsonb_build_object('quest',goal));
end $$;
reset role;
-- Owner-only synthetic setup: an off-board definition without an instance. Client
-- INSERT rights stay revoked; no application write policy is relaxed for this fixture.
with q as (insert into public.quests(owner_id,title,domain,cadence,scheduled_for)
 values('00000000-0000-0000-0000-00000000ca01','Off-board stretch','physical_health','daily',(now() at time zone 'America/Chicago' - interval '5 hours')::date) returning id)
 insert into companion_fixture select 'hiddenHabit',jsonb_build_object('quest',id) from q;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000ca02',false);
set role authenticated;
insert into companion_fixture values('futureOffer',public.companion_command('send',jsonb_build_object('pairId',(select value->>'id' from companion_fixture where label='pair'),
 'requestId','00000000-0000-0000-0000-00000000cb04','title','Plan a trip')));
insert into companion_fixture values('hiddenOffer',public.companion_command('send',jsonb_build_object('pairId',(select value->>'id' from companion_fixture where label='pair'),
 'requestId','00000000-0000-0000-0000-00000000cb05','title','Off-board stretch')));
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000ca01',false);
set role authenticated;
select public.companion_command('accept',jsonb_build_object('questId',(select value->>'questId' from companion_fixture where label='futureOffer')));
select public.companion_command('accept',jsonb_build_object('questId',(select value->>'questId' from companion_fixture where label='hiddenOffer')));
select public.test_companion_assert((select count(*)=1 from public.quests where title='Plan a trip'),'no duplicate future goal');
select public.test_companion_assert((select count(*)=1 from public.quests where title='Off-board stretch'),'no duplicate off-board habit');
select public.companion_command('complete',jsonb_build_object('questId',(select value->>'questId' from companion_fixture where label='futureOffer')));
select public.companion_command('complete',jsonb_build_object('questId',(select value->>'questId' from companion_fixture where label='hiddenOffer')));
select public.test_companion_assert(public.get_lifetime_xp()=8,'both eligible overlaps receive2 once');
select public.companion_command('revoke',jsonb_build_object('pairId',(select value->>'id' from companion_fixture where label='pair')));
select public.test_companion_assert((select count(*)=0 from public.companion_quests),'revocation removes shared RLS access');
select public.test_companion_assert(public.get_lifetime_xp()=8,'revocation never deducts earned XP');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000ca02',false);
set role authenticated;
select public.test_companion_assert(public.companion_command('dashboard')->'quests'='[]','sender loses shared access after revocation');
select public.test_companion_reject('send',(select value from companion_fixture where label='offerPayload'),'Companionship unavailable');
-- Anonymous and authenticated-without-user are distinct negative controls.
reset role;
select set_config('request.jwt.claim.sub','',false);
set role authenticated;
select public.test_companion_reject('dashboard','{}','Sign-in required');
reset role;
set role anon;
do $$ begin
 begin perform public.companion_command('dashboard'); raise exception 'anon RPC succeeded'; exception when insufficient_privilege then null; end;
end $$;
reset role;
drop function public.test_companion_assert(boolean,text),public.test_companion_reject(text,jsonb,text);
select 'PASS companion consent, private reveal, overlap credit, retries, RLS, rain check, revocation and actor separation' as result;
