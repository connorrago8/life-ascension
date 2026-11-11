-- Izzy's quests land on Connor's board when she sends them. One-shot daily or weekly,
-- not a repeating template. Reverse with supabase/rollbacks/202611080004_companion_auto_assign_down.sql.

alter table public.quests add column if not exists companion_one_shot boolean not null default false;
alter table public.companion_quests add column if not exists cadence text
  check (cadence is null or cadence in ('daily','weekly'));

create table if not exists public.companion_tutorial_seen (
  user_id uuid primary key references auth.users(id) on delete cascade,
  izzy_seen_at timestamptz,
  connor_tip_seen_at timestamptz
);
alter table public.companion_tutorial_seen enable row level security;
drop policy if exists companion_tutorial_select on public.companion_tutorial_seen;
create policy companion_tutorial_select on public.companion_tutorial_seen
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists companion_tutorial_insert on public.companion_tutorial_seen;
create policy companion_tutorial_insert on public.companion_tutorial_seen
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists companion_tutorial_update on public.companion_tutorial_seen;
create policy companion_tutorial_update on public.companion_tutorial_seen
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.companion_tutorial_seen from public, anon, authenticated;
grant select, insert, update on public.companion_tutorial_seen to authenticated;

create table if not exists public.companion_parse_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.companion_parse_log enable row level security;
drop policy if exists companion_parse_select on public.companion_parse_log;
create policy companion_parse_select on public.companion_parse_log
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists companion_parse_insert on public.companion_parse_log;
create policy companion_parse_insert on public.companion_parse_log
  for insert to authenticated with check (user_id = (select auth.uid()));
revoke all on public.companion_parse_log from public, anon, authenticated;
grant select, insert on public.companion_parse_log to authenticated;

-- One-shot companion quests keep their original day or week. Later board visits do not mint another.
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

drop function if exists public.companion_send_quest(text, text, date, text);
create function public.companion_send_quest(
  p_title text, p_description text, p_due date, p_reward text, p_cadence text default 'daily')
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  u uuid := auth.uid();
  b public.companion_bonds%rowtype;
  v_id uuid;
  v_title text := btrim(p_title);
  v_desc text := nullif(btrim(coalesce(p_description, '')), '');
  v_reward text := nullif(btrim(coalesce(p_reward, '')), '');
  v_cadence text := case when p_cadence = 'weekly' then 'weekly' else 'daily' end;
  placed jsonb;
  before_count integer;
begin
  if u is null then raise exception 'Sign-in required'; end if;
  select * into b from public.companion_bonds where status = 'active' and companion_id = u for update;
  if not found then raise exception 'Companion connection required'; end if;
  if v_title is null or char_length(v_title) not between 1 and 120 then raise exception 'Invalid title'; end if;
  if v_desc is not null and char_length(v_desc) > 500 then raise exception 'Invalid description'; end if;
  if v_reward is not null and char_length(v_reward) > 200 then raise exception 'Invalid reward'; end if;
  select count(*) into before_count from public.xp_ledger where owner_id = b.inviter_id;
  insert into public.companion_quests(bond_id, from_user, to_user, title, description, due_on, reward_text, status, cadence)
    values (b.id, u, b.inviter_id, v_title, v_desc, p_due, v_reward, 'sent', v_cadence)
    returning id into v_id;
  placed := public._place_companion_quest(v_id);
  if (select count(*) from public.xp_ledger where owner_id = b.inviter_id) <> before_count then
    raise exception 'Sending a quest must not award XP';
  end if;
  return placed || jsonb_build_object('questId', v_id, 'cadence', v_cadence);
end $$;
revoke all on function public.companion_send_quest(text, text, date, text, text) from public, anon;
grant execute on function public.companion_send_quest(text, text, date, text, text) to authenticated;

create or replace function public.companion_respond_quest(p_quest uuid, p_accept boolean)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare u uuid := auth.uid(); q public.companion_quests%rowtype;
begin
  if u is null then raise exception 'Sign-in required'; end if;
  select * into q from public.companion_quests where id = p_quest;
  if not found or u not in (q.from_user, q.to_user) then raise exception 'Quest not found'; end if;
  return jsonb_build_object('status', q.status, 'already', true, 'noop', true, 'instanceId', q.instance_id);
end $$;
revoke all on function public.companion_respond_quest(uuid, boolean) from public, anon;
grant execute on function public.companion_respond_quest(uuid, boolean) to authenticated;

do $$
declare r uuid;
begin
  for r in select id from public.companion_quests where status = 'sent' loop
    update public.companion_quests set cadence = coalesce(cadence, 'daily') where id = r;
    perform public._place_companion_quest(r);
  end loop;
end $$;

notify pgrst, 'reload schema';
