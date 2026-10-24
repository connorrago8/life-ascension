-- Depends on 0003 (quests.scheduled_for, quest_type).
-- Review and apply after the earlier migrations; no production writes in this branch.
-- AI personal API keys do not yet have rename/reschedule/archive wrappers; these RPCs are browser/JWT-only.
create or replace function public.rename_quest(p_quest_id uuid,p_title text)
returns void language plpgsql security definer set search_path=''
as $$
begin
 if (select auth.uid()) is null then raise exception 'Sign-in required'; end if;
 if p_title is null or char_length(btrim(p_title)) not between 1 and 120 then raise exception 'Invalid quest title'; end if;
 update public.quests set title=btrim(p_title)
 where id=p_quest_id and owner_id=(select auth.uid()) and active=true;
 if not found then raise exception 'Active quest not found'; end if;
end $$;

create or replace function public.reschedule_quest(p_quest_id uuid,p_date date)
returns void language plpgsql security definer set search_path=''
as $$
declare q public.quests%rowtype; v_today date;
begin
 if (select auth.uid()) is null then raise exception 'Sign-in required'; end if;
 v_today := (now() at time zone 'America/Chicago')::date;
 if p_date is null or p_date < v_today-30 or p_date > v_today+366 then raise exception 'Date outside scheduling window'; end if;
 select * into q from public.quests where id=p_quest_id and owner_id=(select auth.uid()) and active=true for update;
 if not found then raise exception 'Active quest not found'; end if;
 if q.cadence='once' and exists(select 1 from public.quest_instances where quest_id=q.id and status='completed') then
  raise exception 'Completed quests cannot be rescheduled'; end if;
 -- Do not rewrite a daily habit's history; change only its next start date.
 if q.cadence='daily' then
  -- Defer today's open instance if the habit starts later; keep past completions intact.
  if p_date > v_today then
   update public.quest_instances set status='deferred'
    where quest_id=q.id and due_date=v_today and status='available';
  end if;
  update public.quests set scheduled_for=p_date where id=q.id;
  return;
 end if;
 -- For a one-time quest, moving its pending instance preserves the same ID and XP history.
 if q.quest_type <> 'goal' and q.scheduled_for is null then
  raise exception 'Legacy scheduled chore requires scheduled date backfill'; end if;
 if q.quest_type <> 'goal' and p_date < greatest(v_today,q.scheduled_for) then
  raise exception 'Scheduled chores cannot be moved earlier'; end if;
 if exists(select 1 from public.quest_instances where quest_id=q.id and due_date=p_date) then
  raise exception 'An instance already exists on this date'; end if;
 update public.quest_instances set due_date=p_date where quest_id=q.id and status<>'completed';
 update public.quests set scheduled_for=p_date where id=q.id;
end $$;

create or replace function public.archive_quest(p_quest_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
begin
 if (select auth.uid()) is null then raise exception 'Sign-in required'; end if;
 update public.quests set active=false
 where id=p_quest_id and owner_id=(select auth.uid()) and active=true;
 if not found then raise exception 'Active quest not found'; end if;
 -- Intentionally preserve quest instances, events and xp_ledger.
end $$;

revoke all on function public.rename_quest(uuid,text) from public,anon;
revoke all on function public.reschedule_quest(uuid,date) from public,anon;
revoke all on function public.archive_quest(uuid) from public,anon;
grant execute on function public.rename_quest(uuid,text) to authenticated;
grant execute on function public.reschedule_quest(uuid,date) to authenticated;
grant execute on function public.archive_quest(uuid) to authenticated;

-- Override the completion RPC to prevent archived quests from earning XP.
-- Preserve the scheduling, goal and once-only XP rules from migration 0003.
create or replace function public.set_quest_instance_status(p_instance_id uuid,p_action text)
returns text language plpgsql security definer set search_path = ''
as $$
declare inst public.quest_instances%rowtype; q public.quests%rowtype; v_today date;
begin
 v_today := (now() at time zone 'America/Chicago')::date;
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if p_action not in ('complete','defer','resume') then raise exception 'Unsupported action'; end if;
 select * into inst from public.quest_instances where id=p_instance_id and owner_id=auth.uid() for update;
 if not found then raise exception 'Instance not found'; end if;
 select * into q from public.quests where id=inst.quest_id and owner_id=auth.uid();
 if not found then raise exception 'Quest not found'; end if;
 if inst.status='completed' then return 'completed'; end if;
 if not q.active then raise exception 'Active quest not found'; end if;
 if p_action='complete' then
   if q.cadence='daily' and (inst.due_date>v_today or inst.due_date<q.scheduled_for) then raise exception 'Future daily quests cannot be completed'; end if;
   if q.cadence='once' and q.quest_type<>'goal' and inst.due_date>v_today then raise exception 'Future scheduled quest cannot be completed yet'; end if;
   update public.quest_instances set status='completed',completed_at=now() where id=inst.id;
   insert into public.xp_ledger(owner_id,instance_id,amount) values(auth.uid(),inst.id,1) on conflict(instance_id) do nothing;
   insert into public.quest_events(owner_id,instance_id,event_type) values(auth.uid(),inst.id,'completed');
   return 'completed';
 elsif p_action='defer' and inst.status='available' then
   update public.quest_instances set status='deferred' where id=inst.id;
   insert into public.quest_events(owner_id,instance_id,event_type) values(auth.uid(),inst.id,'deferred');
   return 'deferred';
 elsif p_action='resume' and inst.status='deferred' then
   update public.quest_instances set status='available' where id=inst.id;
   insert into public.quest_events(owner_id,instance_id,event_type) values(auth.uid(),inst.id,'resumed');
   return 'available';
 end if;
 return inst.status;
end $$;
revoke all on function public.set_quest_instance_status(uuid,text) from public,anon;
grant execute on function public.set_quest_instance_status(uuid,text) to authenticated;
