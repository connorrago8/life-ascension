-- Optional Health and Finance templates. Additive.
-- TEST project only: njqwwimzrsunheehnnnt. Do not apply to production.
--
-- Health follow-ups stay locked until HEALTH_FOLLOW_UP_UNLOCK:
--   nightsRequired = 6, nightsInWeek = 7, straightWeeks = 2
-- Those are the two finished Monday–Sunday game weeks before today.
-- Starting one does not award XP. Marking it done uses the existing
-- set_quest_instance_status_v2 path, once. A second finish pays 0.
-- One health template may be in progress at a time.
-- The meal log is unchanged and still awards 0 XP.
-- Finance rows store a status only. They do not store a numeric value.
--
-- Reverse with supabase/rollbacks/202611260020_track_templates_down.sql.
-- The down file drops this table only. It does not delete quests or xp_ledger.

create table public.track_template_states (
  owner_id uuid not null references auth.users(id) on delete cascade,
  track text not null check (track in ('health', 'finance')),
  template_id text not null check (template_id in (
    'protein_meal', 'backup_meal', 'pack_meal', 'add_produce', 'grocery_list',
    'easy_walk', 'walking_route', 'movement_break', 'movement_window', 'repeat_session',
    'pay_down_card', 'cash_buffer', 'upcoming_bills', 'payment_posted', 'promo_deadline',
    'week_spending', 'next_cycle', 'close_month', 'backup_plan'
  )),
  status text not null check (status in ('in_progress', 'complete', 'skipped')),
  quest_id uuid,
  instance_id uuid,
  request_id uuid not null,
  updated_at timestamptz not null default pg_catalog.now(),
  primary key (owner_id, track, template_id),
  unique (owner_id, request_id)
);

create unique index track_template_one_health_active
  on public.track_template_states (owner_id)
  where track = 'health' and status = 'in_progress';

alter table public.track_template_states enable row level security;
alter table public.track_template_states force row level security;
revoke all on public.track_template_states from public, anon, authenticated;
grant select on public.track_template_states to authenticated;
create policy track_template_owner_read on public.track_template_states
  for select to authenticated using ((select auth.uid()) = owner_id);

create or replace function public.health_followups_unlocked(p_owner uuid, p_today date)
returns boolean language plpgsql stable security definer set search_path = ''
as $$
declare
  v_week date;
  v_start date;
  v_count integer;
  v_index integer;
begin
  if p_owner is null or p_today is null or auth.uid() is distinct from p_owner then return false; end if;
  v_week := public.quest_week_start(p_today);
  for v_index in 1..2 loop
    v_start := v_week - (7 * v_index);
    select count(*) into v_count from public.health_lights_out
      where owner_id = p_owner and game_day >= v_start and game_day < v_start + 7;
    if v_count < 6 then return false; end if;
  end loop;
  return true;
end $$;
revoke all on function public.health_followups_unlocked(uuid, date) from public, anon;
grant execute on function public.health_followups_unlocked(uuid, date) to authenticated;

create or replace function public._track_template_title(p_template text)
returns text language sql immutable strict set search_path = ''
as $$
  select case p_template
    when 'protein_meal' then 'Pick a protein-rich meal'
    when 'backup_meal' then 'Choose an easy backup meal'
    when 'pack_meal' then 'Pack a meal before a close'
    when 'add_produce' then 'Add produce to a meal'
    when 'grocery_list' then 'Build a short grocery list'
    when 'easy_walk' then 'Take an easy walk'
    when 'walking_route' then 'Try a different walking route'
    when 'movement_break' then 'Take a movement break'
    when 'movement_window' then 'Schedule a movement window'
    when 'repeat_session' then 'Repeat a movement session that worked'
    when 'pay_down_card' then 'Pay Down a Card'
    when 'cash_buffer' then 'Check the Cash Buffer'
    when 'upcoming_bills' then 'Review Upcoming Bills'
    when 'payment_posted' then 'Confirm a Payment Posted'
    when 'promo_deadline' then 'Check a Promo Deadline'
    when 'week_spending' then 'Review This Week''s Spending'
    when 'next_cycle' then 'Choose My Next Pay Cycle Action'
    when 'close_month' then 'Close the Month'
    when 'backup_plan' then 'Revisit My Backup Plan'
    else null end
$$;
revoke all on function public._track_template_title(text) from public, anon, authenticated;

create or replace function public.start_track_template(p_track text, p_template text, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_existing public.track_template_states%rowtype;
  v_title text;
begin
  if v_owner is null then raise exception 'Sign-in required'; end if;
  if p_request_id is null or p_track not in ('health', 'finance') then raise exception 'Invalid template'; end if;
  v_title := public._track_template_title(p_template);
  if v_title is null then raise exception 'Invalid template'; end if;
  if p_track = 'health' and p_template not in (
    'protein_meal', 'backup_meal', 'pack_meal', 'add_produce', 'grocery_list',
    'easy_walk', 'walking_route', 'movement_break', 'movement_window', 'repeat_session'
  ) then raise exception 'Invalid template'; end if;
  if p_track = 'finance' and p_template not in (
    'pay_down_card', 'cash_buffer', 'upcoming_bills', 'payment_posted', 'promo_deadline',
    'week_spending', 'next_cycle', 'close_month', 'backup_plan'
  ) then raise exception 'Invalid template'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('track-template:' || v_owner::text || ':' || p_track, 0));
  select * into v_existing from public.track_template_states
    where owner_id = v_owner and request_id = p_request_id;
  if found then
    return jsonb_build_object('already', true, 'xp_awarded', 0, 'status', v_existing.status);
  end if;
  select * into v_existing from public.track_template_states
    where owner_id = v_owner and track = p_track and template_id = p_template;
  if found then
    return jsonb_build_object('already', true, 'xp_awarded', 0, 'status', v_existing.status);
  end if;
  if p_track = 'health' and not public.health_followups_unlocked(v_owner, public.quest_today()) then
    raise exception 'Unlocks later';
  end if;
  if p_track = 'health' and exists (
    select 1 from public.track_template_states
    where owner_id = v_owner and track = 'health' and status = 'in_progress'
  ) then
    raise exception 'One health follow-up at a time';
  end if;
  insert into public.track_template_states (owner_id, track, template_id, status, request_id)
  values (v_owner, p_track, p_template, 'in_progress', p_request_id);
  return jsonb_build_object('already', false, 'xp_awarded', 0, 'status', 'in_progress');
end $$;
revoke all on function public.start_track_template(text, text, uuid) from public, anon;
grant execute on function public.start_track_template(text, text, uuid) to authenticated;

create or replace function public.complete_track_template(p_track text, p_template text, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_row public.track_template_states%rowtype;
  v_title text;
  v_domain text;
  v_note text;
  v_quest uuid;
  v_instance uuid;
  v_award jsonb;
  v_xp integer := 0;
  v_today date;
begin
  if v_owner is null then raise exception 'Sign-in required'; end if;
  if p_request_id is null then raise exception 'Invalid template'; end if;
  v_title := public._track_template_title(p_template);
  if v_title is null or p_track not in ('health', 'finance') then raise exception 'Invalid template'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('track-template:' || v_owner::text || ':' || p_track, 0));
  select * into v_row from public.track_template_states
    where owner_id = v_owner and track = p_track and template_id = p_template
    for update;
  if not found then raise exception 'Start the follow-up first'; end if;
  if v_row.status = 'complete' then
    return jsonb_build_object('already', true, 'xp_awarded', 0, 'status', 'complete');
  end if;
  if v_row.status <> 'in_progress' then raise exception 'This follow-up is not in progress'; end if;
  v_today := public.quest_today();
  v_domain := case when p_track = 'health' then 'physical_health' else 'finance' end;
  v_note := case
    when p_template = 'movement_window' then 'Credit when the session is done, not when it is scheduled.'
    when p_track = 'finance' then 'Do this in your private finance workflow, then mark it done.'
    else 'Optional follow-up. Credit when the action is done.'
  end;
  insert into public.quests (owner_id, title, domain, cadence, scheduled_for, quest_type, description)
  values (v_owner, v_title, v_domain, 'once', v_today, 'scheduled', v_note)
  returning id into v_quest;
  insert into public.quest_instances (owner_id, quest_id, due_date)
  values (v_owner, v_quest, v_today)
  returning id into v_instance;
  v_award := public.set_quest_instance_status_v2(v_instance, 'complete');
  v_xp := coalesce((v_award->>'xp_awarded')::integer, 0);
  update public.track_template_states
    set status = 'complete', quest_id = v_quest, instance_id = v_instance,
        request_id = p_request_id, updated_at = pg_catalog.now()
    where owner_id = v_owner and track = p_track and template_id = p_template;
  return jsonb_build_object('already', false, 'xp_awarded', v_xp, 'status', 'complete');
end $$;
revoke all on function public.complete_track_template(text, text, uuid) from public, anon;
grant execute on function public.complete_track_template(text, text, uuid) to authenticated;

create or replace function public.skip_track_template(p_track text, p_template text, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_row public.track_template_states%rowtype;
begin
  if v_owner is null then raise exception 'Sign-in required'; end if;
  if p_request_id is null or public._track_template_title(p_template) is null then raise exception 'Invalid template'; end if;
  if p_template = 'payday_check' then raise exception 'Invalid template'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('track-template:' || v_owner::text || ':' || p_track, 0));
  select * into v_row from public.track_template_states
    where owner_id = v_owner and track = p_track and template_id = p_template
    for update;
  if found and v_row.status = 'complete' then
    return jsonb_build_object('already', true, 'xp_awarded', 0, 'status', 'complete');
  end if;
  if found and v_row.status = 'skipped' then
    return jsonb_build_object('already', true, 'xp_awarded', 0, 'status', 'skipped');
  end if;
  if found then
    update public.track_template_states
      set status = 'skipped', request_id = p_request_id, updated_at = pg_catalog.now()
      where owner_id = v_owner and track = p_track and template_id = p_template;
  else
    if p_track = 'health' and not public.health_followups_unlocked(v_owner, public.quest_today()) then
      raise exception 'Unlocks later';
    end if;
    insert into public.track_template_states (owner_id, track, template_id, status, request_id)
    values (v_owner, p_track, p_template, 'skipped', p_request_id);
  end if;
  return jsonb_build_object('already', false, 'xp_awarded', 0, 'status', 'skipped');
end $$;
revoke all on function public.skip_track_template(text, text, uuid) from public, anon;
grant execute on function public.skip_track_template(text, text, uuid) to authenticated;

notify pgrst, 'reload schema';
