begin;
insert into auth.users(id) values('00000000-0000-0000-0000-000000000091');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000091',true);
do $$
declare q uuid; i uuid; r jsonb; t date := (now() at time zone 'America/Chicago')::date; v_due date;
begin
 q:=public.create_classified_quest('Weekly Main','home','weekly',t-16,'scheduled','main');
 i:=public.ensure_quest_instance(q,t);
 select due_date into v_due from public.quest_instances where id=i;
 if v_due<>t-2 then raise exception 'Weekly anchor drift';end if;
 if public.ensure_quest_instance(q,t)<>i then raise exception 'Occurrence identity changed';end if;
 r:=public.set_quest_instance_status_v2(i,'complete');
 if (r->>'xp_awarded')::integer<>1 or r->>'reward_confirmed'<>'true' then raise exception 'Missing award';end if;
 r:=public.set_quest_instance_status_v2(i,'complete');
 if (r->>'xp_awarded')::integer<>0 or r->>'reward_status'<>'already_awarded' then raise exception 'Duplicate XP';end if;
 if public.set_quest_instance_status(i,'complete')<>'completed' then raise exception 'Legacy path mismatch';end if;
 if (select count(*) from public.xp_ledger where instance_id=i)<>1 then raise exception 'Ledger duplicate';end if;
 if public.ensure_quest_instance(q,t+1)<>i then raise exception 'Completion shifted anchor';end if;
 perform public.archive_quest(q);
 if not exists(select 1 from public.quest_instances where id=i and completed_at is not null and status='completed') then raise exception 'Archived history lost';end if;
 r:=public.set_quest_instance_status_v2(i,'complete');
 if (r->>'xp_awarded')::integer<>0 then raise exception 'Archive retry minted XP';end if;
 q:=public.create_classified_quest('Two-week Side','home','biweekly',t-16,'scheduled','side');
 i:=public.ensure_quest_instance(q,t);
 select due_date into v_due from public.quest_instances where id=i;
 if v_due<>t-2 then raise exception 'Biweekly anchor drift';end if;
 perform public.set_quest_instance_status_v2(i,'defer');
 perform public.set_quest_instance_status_v2(i,'resume');
 if exists(select 1 from public.xp_ledger where instance_id=i) then raise exception 'Non-completion rewarded';end if;
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000099',true);
 begin perform public.set_quest_instance_status_v2(i,'complete');raise exception 'Wrong owner accepted';exception when others then if sqlerrm<>'Instance not found' then raise;end if;end;
end $$;
reset role;
-- Compatibility fixture only: production candidate adds no tracked-progress columns.
alter table public.quests add column target_amount integer;
alter table public.quest_instances add column current_amount integer;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000091',true);
do $$
declare q uuid;i uuid;r jsonb;
begin
 q:=public.create_classified_quest('Existing tracked record','home','daily',(now() at time zone 'America/Chicago')::date,'scheduled','side');
 select id into i from public.quest_instances where quest_id=q;
 perform set_config('test.tracked_id',i::text,true);
end $$;
reset role;
update public.quests set target_amount=3 where id=(select quest_id from public.quest_instances where id=current_setting('test.tracked_id')::uuid);
update public.quest_instances set current_amount=1 where id=current_setting('test.tracked_id')::uuid;
set local role authenticated;
do $$ begin
 begin perform public.set_quest_instance_status_v2(current_setting('test.tracked_id')::uuid,'complete');raise exception 'V2 target bypass';exception when others then if sqlerrm<>'Tracked quest has not reached its target' then raise;end if;end;
 begin perform public.set_quest_instance_status(current_setting('test.tracked_id')::uuid,'complete');raise exception 'Legacy target bypass';exception when others then if sqlerrm<>'Tracked quest has not reached its target' then raise;end if;end;
end $$;
rollback;
