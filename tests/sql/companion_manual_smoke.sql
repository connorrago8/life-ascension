-- Isolated test only. No hosted accounts or data.
begin;
insert into auth.users(id) values('00000000-0000-0000-0000-00000000ba01'),('00000000-0000-0000-0000-00000000ba02'),('00000000-0000-0000-0000-00000000ba03');
insert into public.companion_pairs(id,inviter_id,member_id,inviter_role,status) values('00000000-0000-0000-0000-00000000ba10','00000000-0000-0000-0000-00000000ba01','00000000-0000-0000-0000-00000000ba02','recipient','active');
create function public.manual_assert(ok boolean) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'Manual journal assertion failed'; end if; end$$;
create function public.manual_reject(action text,payload jsonb) returns void language plpgsql security invoker as $$begin
 begin perform public.companion_activity(action,payload); exception when others then return; end;
 raise exception 'Expected manual rejection'; end$$;
grant execute on function public.manual_assert(boolean),public.manual_reject(text,jsonb) to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000ba01',true);
select public.manual_assert(not has_table_privilege('authenticated','companion_private.activity_entries','select'));
select public.manual_assert(not has_table_privilege('authenticated','companion_private.activity_entries','insert'));
select public.manual_assert(not has_table_privilege('authenticated','companion_private.activity_corrections','update'));
select public.companion_activity('log','{"pairId":"00000000-0000-0000-0000-00000000ba10","requestId":"00000000-0000-0000-0000-00000000ba11","title":"Read together","date":"2026-11-01","ownerId":"00000000-0000-0000-0000-00000000ba03","xp":999}');
select public.companion_activity('log','{"pairId":"00000000-0000-0000-0000-00000000ba10","requestId":"00000000-0000-0000-0000-00000000ba11","title":"Read together","date":"2026-11-01"}');
select public.manual_assert((public.companion_activity('week','{"pairId":"00000000-0000-0000-0000-00000000ba10","date":"2026-11-01"}')->>'weeklyXp')::integer=1);
select public.manual_assert(public.companion_activity('week','{"pairId":"00000000-0000-0000-0000-00000000ba10","date":"2026-11-01"}')->>'weekStart'='2026-10-26');
select public.manual_reject('log','{"pairId":"00000000-0000-0000-0000-00000000ba10","requestId":"00000000-0000-0000-0000-00000000ba12","title":" READ   together ","date":"2026-11-01"}');
select public.manual_reject('log','{"pairId":"00000000-0000-0000-0000-00000000ba10","requestId":"00000000-0000-0000-0000-00000000ba11","title":"Changed retry","date":"2026-11-01"}');
select public.companion_activity('log','{"pairId":"00000000-0000-0000-0000-00000000ba10","requestId":"00000000-0000-0000-0000-00000000ba13","title":"Walk together","date":"2026-11-02"}');
select public.manual_assert(public.companion_activity('week','{"pairId":"00000000-0000-0000-0000-00000000ba10","date":"2026-11-02"}')->>'weekStart'='2026-11-02');
select public.manual_assert((public.companion_activity('week','{"pairId":"00000000-0000-0000-0000-00000000ba10","date":"2026-11-02"}')->>'weeklyXp')::integer=1);
select public.manual_reject('log',jsonb_build_object('pairId','00000000-0000-0000-0000-00000000ba10','requestId','00000000-0000-0000-0000-00000000ba14','title','Future','date',((now() at time zone 'America/Chicago')::date+1)::text));
select public.manual_reject('log','{"pairId":"00000000-0000-0000-0000-00000000ba10","requestId":"bad","title":"Invalid","date":"2026-02-30"}');
-- Sender and outsider cannot inspect or create the recipient's private journal.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000ba02',true);
select public.manual_reject('week','{"pairId":"00000000-0000-0000-0000-00000000ba10"}');
select public.manual_reject('log','{"pairId":"00000000-0000-0000-0000-00000000ba10","requestId":"00000000-0000-0000-0000-00000000ba15","title":"Forged","date":"2026-11-01"}');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000ba03',true);
select public.manual_reject('week','{"pairId":"00000000-0000-0000-0000-00000000ba10"}');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000ba01',true);
-- An append-only correction preserves original payload and an idempotent reason.
do $$declare j jsonb; e text; payload jsonb; begin
 j:=public.companion_activity('week','{"pairId":"00000000-0000-0000-0000-00000000ba10","date":"2026-11-01"}'); e:=j->'entries'->0->>'id';
 payload:=jsonb_build_object('pairId','00000000-0000-0000-0000-00000000ba10','entryId',e,'requestId','00000000-0000-0000-0000-00000000ba16','reason','Wrong date');
 perform public.companion_activity('correct',payload);perform public.companion_activity('correct',payload);
 j:=public.companion_activity('week','{"pairId":"00000000-0000-0000-0000-00000000ba10","date":"2026-11-01"}');
 perform public.manual_assert((j->>'weeklyXp')::integer=0 and jsonb_array_length(j->'entries')=1 and j->'entries'->0->>'title'='Read together' and j->'entries'->0->>'correctionReason'='Wrong date');
 perform public.manual_reject('correct',payload||'{"reason":"Changed reason"}'::jsonb);
end$$;
select public.companion_command('revoke','{"pairId":"00000000-0000-0000-0000-00000000ba10"}');
select public.manual_assert((public.companion_activity('week','{"pairId":"00000000-0000-0000-0000-00000000ba10","date":"2026-11-02"}')->>'canLog')::boolean=false);
select public.manual_reject('log','{"pairId":"00000000-0000-0000-0000-00000000ba10","requestId":"00000000-0000-0000-0000-00000000ba17","title":"After revocation","date":"2026-11-02"}');
reset role;
select public.manual_assert(not exists(select 1 from public.xp_ledger where owner_id in ('00000000-0000-0000-0000-00000000ba01','00000000-0000-0000-0000-00000000ba02')));
select public.manual_assert((select count(*) from companion_private.activity_entries where owner_id='00000000-0000-0000-0000-00000000ba01')=2);
select public.manual_assert((select count(*) from companion_private.activity_corrections where owner_id='00000000-0000-0000-0000-00000000ba01')=1);
select public.manual_assert(not has_function_privilege('anon','public.companion_activity(text,jsonb)','execute'));
rollback;
select 'PASS private manual activity: retries, normalization, corrections, week/DST dates, consent roles, revocation and no account XP';
