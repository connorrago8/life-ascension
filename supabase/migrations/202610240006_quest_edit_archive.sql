-- Depends on 0003 (quests.scheduled_for, quest_type).
-- Review and apply after the earlier migrations; no production writes in this branch.
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
 if exists(select 1 from public.quest_instances where quest_id=q.id and status='completed') then
  raise exception 'Completed quests cannot be rescheduled'; end if;
 -- Do not rewrite a daily habit's history; change only its next start date.
 if q.cadence='daily' then
  update public.quests set scheduled_for=p_date where id=q.id;
  return;
 end if;
 -- For a one-time quest, moving its pending instance preserves the same ID and XP history.
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
