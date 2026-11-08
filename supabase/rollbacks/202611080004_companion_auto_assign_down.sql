-- Reverse 202611080004. Quests go back to waiting for Connor, and one-shot placement is removed.
begin;

drop function if exists public.companion_send_quest(text, text, date, text, text);
drop function if exists public._place_companion_quest(uuid);

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
 if q.scheduled_for is not null and p_date < q.scheduled_for
    and not (q.cadence = 'weekly' and public.quest_week_start(p_date) >= public.quest_week_start(q.scheduled_for)) then
  raise exception 'Quest not yet scheduled';
 end if;
 if q.cadence = 'daily' and p_date < v_today - 2 then
  raise exception 'Daily instances cannot be opened before the last 2 days';
 end if;
 if q.cadence = 'weekly' then
  v_date := public.quest_week_start(p_date);
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

alter table public.quests drop column if exists companion_one_shot;
alter table public.companion_quests drop column if exists cadence;
drop table if exists public.companion_tutorial_seen;
drop table if exists public.companion_parse_log;

create or replace function public.companion_send_quest(
  p_title text, p_description text, p_due date, p_reward text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  u uuid := auth.uid();
  b public.companion_bonds%rowtype;
  v_id uuid;
  v_title text := btrim(p_title);
  v_desc text := nullif(btrim(coalesce(p_description, '')), '');
  v_reward text := nullif(btrim(coalesce(p_reward, '')), '');
begin
  if u is null then raise exception 'Sign-in required'; end if;
  select * into b from public.companion_bonds where status = 'active' and companion_id = u for update;
  if not found then raise exception 'Companion connection required'; end if;
  if v_title is null or char_length(v_title) not between 1 and 120 then raise exception 'Invalid title'; end if;
  if v_desc is not null and char_length(v_desc) > 500 then raise exception 'Invalid description'; end if;
  if v_reward is not null and char_length(v_reward) > 200 then raise exception 'Invalid reward'; end if;
  insert into public.companion_quests(bond_id, from_user, to_user, title, description, due_on, reward_text, status)
    values (b.id, u, b.inviter_id, v_title, v_desc, p_due, v_reward, 'sent')
    returning id into v_id;
  return jsonb_build_object('questId', v_id, 'status', 'sent');
end $$;

create or replace function public.companion_respond_quest(p_quest uuid, p_accept boolean)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  u uuid := auth.uid();
  q public.companion_quests%rowtype;
  b public.companion_bonds%rowtype;
  v_today date;
  v_due date;
  v_norm text;
  v_quest uuid;
  v_inst uuid;
  v_status text;
begin
  if u is null then raise exception 'Sign-in required'; end if;
  select * into q from public.companion_quests where id = p_quest for update;
  if not found or q.to_user <> u then raise exception 'Quest not found'; end if;
  select * into b from public.companion_bonds where id = q.bond_id;
  if b.status <> 'active' then raise exception 'Companion connection required'; end if;
  if q.status = 'declined' and p_accept is false then
    return jsonb_build_object('status', 'declined', 'already', true);
  end if;
  if q.status <> 'sent' then raise exception 'Already decided'; end if;
  if p_accept is not true then
    update public.companion_quests set status = 'declined' where id = q.id;
    return jsonb_build_object('status', 'declined', 'already', false);
  end if;
  v_today := public.quest_game_day(pg_catalog.now(), public.quest_timezone(u));
  v_due := coalesce(q.due_on, v_today);
  v_norm := public.companion_title_key(q.title);
  select i.quest_id, i.id, i.status into v_quest, v_inst, v_status
    from public.quests existing
    join public.quest_instances i on i.quest_id = existing.id and i.owner_id = existing.owner_id
    where existing.owner_id = u and existing.active
      and public.companion_title_key(existing.title) = v_norm
      and (
        (existing.cadence = 'daily' and i.due_date = v_today)
        or (existing.cadence in ('once','weekly') and i.status <> 'completed')
        or (i.status = 'completed' and public.quest_game_day(i.completed_at, public.quest_timezone(u)) = v_today)
      )
    order by (i.status = 'available') desc, i.created_at desc
    limit 1;
  if v_inst is null then
    v_quest := public.create_scheduled_quest(q.title, 'relationships', 'once', v_due, 'scheduled');
    select id into v_inst from public.quest_instances where quest_id = v_quest and owner_id = u order by created_at desc limit 1;
    v_status := 'available';
  end if;
  update public.companion_quests
    set status = case when v_status = 'completed' then 'completed' else 'accepted' end,
        quest_id = v_quest,
        instance_id = v_inst,
        accepted_at = pg_catalog.now(),
        completed_at = case when v_status = 'completed' then pg_catalog.now() else null end
    where id = q.id;
  return jsonb_build_object(
    'status', case when v_status = 'completed' then 'completed' else 'accepted' end,
    'instanceId', v_inst,
    'linkedExisting', v_status is not null and v_quest is not null);
end $$;

commit;
