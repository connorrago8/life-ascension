-- Preserve all completion window and archive protections from 0007.
-- Enforce tracked quest target for browser and service-role wrapper completion paths.
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
 -- Same order as 0006: an already completed instance stays completed, including after archive.
 if inst.status='completed' then return 'completed'; end if;
 if not q.active then raise exception 'Active quest not found'; end if;
 if p_action='complete' then
   -- Tracked quests must reach their target before any completion path awards XP.
   -- This also protects service-role API-key wrappers that call this RPC.
   if q.target_amount is not null and inst.current_amount <> q.target_amount then
     raise exception 'Tracked quest has not reached its target';
   end if;
   if q.cadence='daily' and (inst.due_date > v_today or inst.due_date < q.scheduled_for) then
    raise exception 'Future daily quests cannot be completed';
   end if;
   if q.cadence='daily' and inst.due_date < v_today - 2 then
    raise exception 'Daily quests can only be completed for today or the previous 2 days';
   end if;
   if q.cadence='once' and q.quest_type<>'goal' and inst.due_date>v_today then
    raise exception 'Future scheduled quest cannot be completed yet';
   end if;
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

notify pgrst, 'reload schema';
