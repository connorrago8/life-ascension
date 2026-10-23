-- Scheduled one-time quests: atomic creation with its dated instance.
-- Run only after review; not applied to the production database.
alter table public.quests add column if not exists scheduled_for date;
create or replace function public.create_scheduled_quest(p_title text,p_domain text,p_cadence text,p_date date)
returns uuid language plpgsql security invoker set search_path = ''
as $$
declare v_id uuid; v_today date;
begin
 v_today := (now() at time zone 'America/Chicago')::date;
 if auth.uid() is null then raise exception 'Sign-in required'; end if;
 if p_title is null or length(trim(p_title)) not between 1 and 120 then raise exception 'Invalid title'; end if;
 if p_domain not in ('hygiene','home','mental_health','personal_growth','finance','career','relationships','physical_health') then raise exception 'Invalid domain'; end if;
 if p_cadence not in ('once','daily') then raise exception 'Invalid cadence'; end if;
 if p_date is null or p_date < v_today - 30 or p_date > v_today + 3650 then raise exception 'Date out of range'; end if;
 insert into public.quests(owner_id,title,domain,cadence,scheduled_for)
 values(auth.uid(),trim(p_title),p_domain,p_cadence,p_date) returning id into v_id;
 insert into public.quest_instances(owner_id,quest_id,due_date)
 values(auth.uid(),v_id,p_date);
 return v_id;
end $$;
revoke all on function public.create_scheduled_quest(text,text,text,date) from public,anon;
grant execute on function public.create_scheduled_quest(text,text,text,date) to authenticated;

-- Existing daily instance creation must not activate a scheduled quest prematurely.
create or replace function public.ensure_quest_instance(p_quest_id uuid,p_date date default current_date)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare q public.quests%rowtype; v_id uuid; v_today date;
begin
 v_today := (now() at time zone 'America/Chicago')::date;
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if p_date is null or p_date < v_today-30 or p_date > v_today+3650 then raise exception 'Date outside allowed window'; end if;
 select * into q from public.quests where id=p_quest_id and owner_id=auth.uid() and active;
 if not found then raise exception 'Quest not found'; end if;
 if q.scheduled_for is not null and p_date < q.scheduled_for then raise exception 'Quest not yet scheduled'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(q.id::text,0));
 if q.cadence='once' then
   select id into v_id from public.quest_instances where quest_id=q.id limit 1;
   if found then return v_id; end if;
 end if;
 insert into public.quest_instances(owner_id,quest_id,due_date)
 values(auth.uid(),q.id,p_date)
 on conflict(quest_id,due_date) do update set due_date=excluded.due_date returning id into v_id;
 return v_id;
end $$;
revoke all on function public.ensure_quest_instance(uuid,date) from public,anon;
grant execute on function public.ensure_quest_instance(uuid,date) to authenticated;
