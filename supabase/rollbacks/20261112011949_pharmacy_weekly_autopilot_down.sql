-- Reverse 20261112011949_pharmacy_weekly_autopilot.sql.
-- Restores the 05:00 seeded weekly reveal and the companion ensure / place bodies.
-- Quest rows, instances, and ledger history stay. Weekday columns go away.

create or replace function public.ensure_quest_instance(p_quest_id uuid,p_date date default public.quest_today())
returns uuid language plpgsql security definer set search_path = ''
as $$
declare q public.quests%rowtype; v_id uuid; v_today date; v_date date := p_date;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 v_today := public.quest_game_day(pg_catalog.now(), public.quest_timezone(auth.uid()));
 if p_date is null then p_date := v_today; v_date := v_today; end if;
 if p_date < v_today-30 or p_date > v_today+1 then raise exception 'Date outside allowed window'; end if;
 select * into q from public.quests where id=p_quest_id and owner_id=auth.uid() and active;
 if not found then raise exception 'Quest not found'; end if;
 if q.companion_one_shot and q.cadence = 'daily' then
  v_date := coalesce(q.scheduled_for, p_date);
 elsif q.companion_one_shot and q.cadence = 'weekly' then
  v_date := public.quest_week_start(coalesce(q.scheduled_for, p_date));
 elsif q.cadence = 'weekly' then
  v_date := public.quest_week_start(p_date);
 end if;
 if q.companion_one_shot then
  select id into v_id from public.quest_instances where quest_id = q.id and due_date = v_date and owner_id = auth.uid();
  if v_id is not null then return v_id; end if;
 end if;
 if q.scheduled_for is not null and p_date < q.scheduled_for
    and not (q.cadence = 'weekly' and public.quest_week_start(p_date) >= public.quest_week_start(q.scheduled_for)) then
  raise exception 'Quest not yet scheduled';
 end if;
 if q.cadence = 'daily' and p_date < v_today - 2 and not q.companion_one_shot then
  raise exception 'Daily instances cannot be opened before the last 2 days';
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(q.id::text,0));
 if q.cadence='once' then
   select id into v_id from public.quest_instances where quest_id=q.id limit 1;
   if found then return v_id; end if;
 end if;
 insert into public.quest_instances(owner_id,quest_id,due_date)
 values(auth.uid(),q.id,v_date)
 on conflict(quest_id,due_date) do update set due_date=excluded.due_date returning id into v_id;
 return v_id;
end $$;
revoke all on function public.ensure_quest_instance(uuid,date) from public,anon;
grant execute on function public.ensure_quest_instance(uuid,date) to authenticated;

create or replace function public._place_companion_quest(p_quest uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  q public.companion_quests%rowtype;
  v_today date;
  v_due date;
  v_norm text;
  v_cadence text;
  v_quest uuid;
  v_inst uuid;
  v_status text;
  v_instance_due date;
begin
  select * into q from public.companion_quests where id = p_quest for update;
  if not found then raise exception 'Quest not found'; end if;
  if q.status in ('declined') then
    return jsonb_build_object('status', q.status, 'instanceId', q.instance_id);
  end if;
  if q.status in ('accepted','completed') and q.instance_id is not null then
    return jsonb_build_object('status', q.status, 'instanceId', q.instance_id, 'dueOn', q.due_on, 'cadence',
      (select cadence from public.quests where id = q.quest_id));
  end if;
  v_today := public.quest_game_day(pg_catalog.now(), public.quest_timezone(q.to_user));
  v_due := coalesce(q.due_on, v_today);
  if v_due < v_today - 30 or v_due > v_today + 366 then raise exception 'Date out of range'; end if;
  v_cadence := case when q.cadence = 'weekly' then 'weekly' else 'daily' end;
  v_norm := public.companion_title_key(q.title);
  v_instance_due := case when v_cadence = 'weekly' then public.quest_week_start(v_due) else v_due end;
  select existing.id, i.id, i.status into v_quest, v_inst, v_status
    from public.quests existing
    join public.quest_instances i on i.quest_id = existing.id and i.owner_id = existing.owner_id
    where existing.owner_id = q.to_user and existing.active
      and public.companion_title_key(existing.title) = v_norm
      and i.due_date = v_instance_due
    order by (i.status = 'available') desc, i.created_at desc
    limit 1;
  if v_inst is null then
    insert into public.quests(owner_id, title, domain, cadence, scheduled_for, quest_type, companion_one_shot)
      values (q.to_user, q.title, 'relationships', v_cadence, v_due, 'scheduled', true)
      returning id into v_quest;
    insert into public.quest_instances(owner_id, quest_id, due_date)
      values (q.to_user, v_quest, v_instance_due)
      returning id into v_inst;
    v_status := 'available';
  end if;
  update public.companion_quests
    set status = case when v_status = 'completed' then 'completed' else 'accepted' end,
        due_on = v_due,
        quest_id = v_quest,
        instance_id = v_inst,
        accepted_at = coalesce(accepted_at, pg_catalog.now()),
        completed_at = case when v_status = 'completed' then coalesce(completed_at, pg_catalog.now()) else completed_at end
    where id = q.id;
  return jsonb_build_object(
    'status', case when v_status = 'completed' then 'completed' else 'accepted' end,
    'questId', q.id,
    'instanceId', v_inst,
    'dueOn', v_due,
    'cadence', v_cadence);
end $$;
revoke all on function public._place_companion_quest(uuid) from public, anon, authenticated, service_role;

drop function if exists public.apply_pharmacy_weekly_pack_for_user(uuid);
drop function if exists public.apply_pharmacy_weekly_pack();
drop function if exists public._apply_pharmacy_weekly_pack(uuid);
drop function if exists public.create_weekly_autopilot_quest(text, text, integer);
drop function if exists public._insert_weekly_autopilot_quest(uuid, text, text, integer);
drop function if exists public.quest_title_key(text);

drop function if exists public.quest_weekly_appears_at(uuid, uuid, date, text);
create function public.quest_weekly_appears_at(p_owner uuid, p_quest uuid, p_week date, p_tz text)
returns timestamptz language sql stable strict set search_path = ''
as $$
  select ((p_week::timestamp + interval '5 hours'
    + pg_catalog.make_interval(mins => (public.quest_fnv1a(p_owner::text || ':' || p_quest::text || ':' || p_week::text) % 4740)::integer))
    at time zone p_tz)
$$;
revoke all on function public.quest_weekly_appears_at(uuid, uuid, date, text) from public, anon, authenticated;

alter table public.quests drop constraint if exists quests_fixed_reveal_weekday_check;
alter table public.quests drop constraint if exists quests_weekly_weekday_check;
alter table public.quests drop column if exists weekly_weekday;
alter table public.quests drop column if exists fixed_reveal;

notify pgrst, 'reload schema';
