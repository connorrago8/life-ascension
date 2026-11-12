-- Couple quests, Sunday recap, date-night plans, and Connor's monthly streak shield.
-- Additive. Reverse with supabase/rollbacks/202611120001_couple_features_down.sql.
-- Apply to TEST only. Do not apply to production.
--
-- Connor's couple-quest XP is minted only by _award_personal_quest_xp (base 10,
-- first quest of the game day flat, later quests half-up streak scaled).
-- Izzy's share is couple_xp_config.companion_xp (founder decision: 10) into
-- companion_xp_ledger, once per quest period. Updating that row needs no schema change.
-- A shield bridges exactly one missed game day, grants no XP, and does not stack.
-- Shield allowance (approved, v3 Option A): one per month, resetting at the
-- 05:00 America/Chicago game-day boundary on the 1st. 04:59 on the 1st is still
-- the previous month. Spending a shield is never silent: get_streak_shield
-- returns a sentence that names the covered day.
--
-- Sunday recap (approved): visible on the Sunday game day, which begins at
-- 05:00 America/Chicago. It covers the previous 7 complete game days,
-- previous Sunday 05:00 through this Sunday 04:59:59 (end exclusive at 05:00).

create table if not exists public.couple_xp_config (
  singleton boolean primary key default true check (singleton),
  companion_xp integer not null default 10 check (companion_xp >= 0 and companion_xp <= 1000000)
);
insert into public.couple_xp_config(singleton, companion_xp)
values (true, 10)
on conflict (singleton) do nothing;

create table if not exists public.streak_shields (
  owner_id uuid not null references auth.users(id) on delete cascade,
  month_key date not null,
  bridged_day date not null,
  created_at timestamptz not null default now(),
  primary key (owner_id, month_key),
  unique (owner_id, bridged_day),
  check (month_key = date_trunc('month', bridged_day)::date)
);

create table if not exists public.companion_xp_ledger (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  bond_id uuid not null references public.companion_bonds(id) on delete cascade,
  amount integer not null check (amount between 1 and 1000000),
  source_key text not null unique,
  reason text not null check (reason in ('couple_quest')),
  created_at timestamptz not null default now()
);

create table if not exists public.couple_quests (
  id uuid primary key default gen_random_uuid(),
  bond_id uuid not null references public.companion_bonds(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  description text check (description is null or char_length(description) <= 500),
  cadence text not null check (cadence in ('once', 'weekly', 'monthly')),
  kind text not null default 'shared' check (kind in ('shared', 'date_night')),
  title_key text not null check (char_length(title_key) between 1 and 120),
  due_at timestamptz,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (bond_id, title_key)
);

create table if not exists public.couple_quest_steps (
  id uuid primary key default gen_random_uuid(),
  quest_id uuid not null references public.couple_quests(id) on delete cascade,
  position smallint not null check (position between 1 and 5),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  done_at timestamptz,
  done_by uuid,
  unique (quest_id, position)
);

create table if not exists public.couple_quest_marks (
  quest_id uuid not null references public.couple_quests(id) on delete cascade,
  period_key date not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  marked_at timestamptz not null default now(),
  primary key (quest_id, period_key, user_id)
);

create table if not exists public.couple_quest_awards (
  id uuid primary key default gen_random_uuid(),
  quest_id uuid not null references public.couple_quests(id) on delete cascade,
  period_key date not null,
  bond_id uuid not null references public.companion_bonds(id) on delete cascade,
  personal_quest_id uuid not null,
  instance_id uuid not null unique,
  companion_ledger_id uuid,
  companion_xp integer not null check (companion_xp >= 0),
  created_at timestamptz not null default now(),
  unique (quest_id, period_key)
);

create index if not exists couple_quests_bond_idx on public.couple_quests (bond_id, created_at desc);
create index if not exists companion_xp_ledger_owner_idx on public.companion_xp_ledger (owner_id, created_at);

alter table public.couple_xp_config enable row level security;
alter table public.streak_shields enable row level security;
alter table public.companion_xp_ledger enable row level security;
alter table public.couple_quests enable row level security;
alter table public.couple_quest_steps enable row level security;
alter table public.couple_quest_marks enable row level security;
alter table public.couple_quest_awards enable row level security;

drop policy if exists couple_xp_config_read on public.couple_xp_config;
create policy couple_xp_config_read on public.couple_xp_config
  for select to authenticated using (true);
drop policy if exists streak_shields_read on public.streak_shields;
create policy streak_shields_read on public.streak_shields
  for select to authenticated using (owner_id = (select auth.uid()));
drop policy if exists companion_xp_ledger_read on public.companion_xp_ledger;
create policy companion_xp_ledger_read on public.companion_xp_ledger
  for select to authenticated using (owner_id = (select auth.uid()));
drop policy if exists couple_quests_read on public.couple_quests;
create policy couple_quests_read on public.couple_quests
  for select to authenticated using (
    exists (
      select 1 from public.companion_bonds b
      where b.id = bond_id and b.status = 'active'
        and (select auth.uid()) in (b.inviter_id, b.companion_id)
    )
  );
drop policy if exists couple_steps_read on public.couple_quest_steps;
create policy couple_steps_read on public.couple_quest_steps
  for select to authenticated using (
    exists (
      select 1 from public.couple_quests q
      join public.companion_bonds b on b.id = q.bond_id
      where q.id = quest_id and b.status = 'active'
        and (select auth.uid()) in (b.inviter_id, b.companion_id)
    )
  );
drop policy if exists couple_marks_read on public.couple_quest_marks;
create policy couple_marks_read on public.couple_quest_marks
  for select to authenticated using (
    exists (
      select 1 from public.couple_quests q
      join public.companion_bonds b on b.id = q.bond_id
      where q.id = quest_id and b.status = 'active'
        and (select auth.uid()) in (b.inviter_id, b.companion_id)
    )
  );
drop policy if exists couple_awards_read on public.couple_quest_awards;
create policy couple_awards_read on public.couple_quest_awards
  for select to authenticated using (
    exists (
      select 1 from public.companion_bonds b
      where b.id = bond_id and b.status = 'active'
        and (select auth.uid()) in (b.inviter_id, b.companion_id)
    )
  );

revoke all on public.couple_xp_config, public.streak_shields, public.companion_xp_ledger,
  public.couple_quests, public.couple_quest_steps, public.couple_quest_marks, public.couple_quest_awards
  from public, anon, authenticated;
grant select on public.couple_xp_config, public.streak_shields, public.companion_xp_ledger,
  public.couple_quests, public.couple_quest_steps, public.couple_quest_marks, public.couple_quest_awards
  to authenticated;

create or replace function public.couple_title_key(p_title text)
returns text language sql immutable strict set search_path = ''
as $$ select lower(pg_catalog.regexp_replace(pg_catalog.btrim(p_title), '\s+', ' ', 'g')) $$;
revoke all on function public.couple_title_key(text) from public, anon, authenticated;

create or replace function public.xp_to_reach_level(p_level integer)
returns bigint language sql immutable strict set search_path = ''
as $$
  select case when p_level <= 1 then 0
    else (5::bigint * (p_level::bigint * (p_level::bigint + 1) - 2)) / 2
  end
$$;
revoke all on function public.xp_to_reach_level(integer) from public, anon, authenticated;

create or replace function public.profile_level(p_xp bigint)
returns integer language plpgsql immutable set search_path = ''
as $$
declare lvl integer := 1; total bigint := greatest(coalesce(p_xp, 0), 0);
begin
  while lvl < 100000 and public.xp_to_reach_level(lvl + 1) <= total loop
    lvl := lvl + 1;
  end loop;
  return lvl;
end $$;
revoke all on function public.profile_level(bigint) from public, anon, authenticated;

create or replace function public.couple_companion_xp()
returns integer language sql stable security definer set search_path = ''
as $$
  select coalesce((select companion_xp from public.couple_xp_config where singleton), 10)
$$;
revoke all on function public.couple_companion_xp() from public, anon, authenticated, service_role;

-- Read-only fire. Honors shields already recorded. Does not grant XP or write.
create or replace function public._quest_streak_fire_at(p_owner uuid, p_today date, p_tz text)
returns integer language plpgsql stable set search_path = ''
as $$
declare d date := p_today - 1; n integer := 0; guard integer := 0; bridged date;
begin
  if p_owner is null or p_today is null or p_tz is null then return 0; end if;
  while guard < 4000 loop
    guard := guard + 1;
    if public.quest_has_completion_on(p_owner, d, p_tz) then
      n := n + 1;
      d := d - 1;
      continue;
    end if;
    if public.quest_has_completion_on(p_owner, d - 1, p_tz) then
      select s.bridged_day into bridged from public.streak_shields s
        where s.owner_id = p_owner and s.month_key = pg_catalog.date_trunc('month', d)::date;
      if found and bridged = d then
        d := d - 1;
        continue;
      end if;
    end if;
    exit;
  end loop;
  return n;
end $$;
revoke all on function public._quest_streak_fire_at(uuid, date, text) from public, anon, authenticated, service_role;

-- Streak reads MUST be pure: neither a page view nor an XP calculation may spend a shield.
-- Existing confirmed bridges are honored by _quest_streak_fire_at.
create or replace function public.quest_streak_fire(p_owner uuid, p_today date, p_tz text)
returns integer language sql stable set search_path = ''
as $$ select public._quest_streak_fire_at(p_owner, p_today, p_tz) $$;
revoke all on function public.quest_streak_fire(uuid, date, text) from public, anon, authenticated;

-- This is the ONLY shield-spending entrypoint. The UI must show the covered
-- date and call this RPC only after the authenticated player taps "Use Shield".
-- Never call from a background job, status read, or automatic XP award.
create or replace function public.confirm_streak_shield(p_missed_day date)
returns jsonb language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_today date := public.quest_game_day(pg_catalog.now(), 'America/Chicago');
  v_month date;
  v_existing date;
begin
  if v_owner is null then raise exception 'Authentication required'; end if;
  if p_missed_day is null or p_missed_day >= v_today then
    raise exception 'Shield day must be a past game day';
  end if;
  -- The protected day must be an actual one-day gap between qualifying days.
  if public.quest_has_completion_on(v_owner, p_missed_day, 'America/Chicago')
     or not public.quest_has_completion_on(v_owner, p_missed_day - 1, 'America/Chicago')
     or not public.quest_has_completion_on(v_owner, p_missed_day + 1, 'America/Chicago') then
    raise exception 'Shield requires one missed day between completed days';
  end if;
  v_month := pg_catalog.date_trunc('month', p_missed_day)::date;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('streak-shield:' || v_owner::text, 0));
  select bridged_day into v_existing from public.streak_shields
    where owner_id = v_owner and month_key = v_month;
  if v_existing is not null and v_existing <> p_missed_day then
    raise exception 'Monthly shield already used';
  end if;
  insert into public.streak_shields(owner_id, month_key, bridged_day)
    values (v_owner, v_month, p_missed_day)
    on conflict (owner_id, month_key) do nothing;
  return pg_catalog.jsonb_build_object(
    'status', 'used', 'month', v_month, 'bridgedDay', p_missed_day,
    'notice', 'Streak Shield used · 0 remaining. Streak protected. You missed a day, but your journey continues. No XP was awarded.');
end $$;
revoke all on function public.confirm_streak_shield(date) from public, anon;
grant execute on function public.confirm_streak_shield(date) to authenticated;

-- Allowance month containing this instant. 1st at 04:59 Chicago is the previous month.
create or replace function public.streak_shield_month(p_at timestamptz)
returns date language sql stable strict set search_path = ''
as $$
  select pg_catalog.date_trunc('month', public.quest_game_day(p_at, 'America/Chicago'))::date
$$;
revoke all on function public.streak_shield_month(timestamptz) from public, anon, authenticated;

create or replace function public._streak_shield_status(p_owner uuid, p_at timestamptz)
returns jsonb language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_today date;
  v_month date;
  v_day date;
  v_notice text;\n  v_candidate date;\n  v_cursor date;\nbegin\n  if p_owner is null or p_at is null then raise exception 'Authentication required'; end if;
  v_today := public.quest_game_day(p_at, 'America/Chicago');
  -- Read-only status. No implicit shield consumption.
  v_month := public.streak_shield_month(p_at);
  select s.bridged_day into v_day from public.streak_shields s
    where s.owner_id = p_owner and s.month_key = v_month;
  if v_day is null then
    v_notice := 'Streak shield: ready';
  else
    v_notice := 'Streak shield: used. It covered ' || pg_catalog.to_char(v_day, 'FMMonth FMDD')
      || '. That missed day granted no XP.';
  end if;
  return pg_catalog.jsonb_build_object(
    'status', case when v_day is null then 'ready' else 'used' end,
    'month', v_month,
    'bridgedDay', v_day,
    'notice', v_notice);
end $$;
revoke all on function public._streak_shield_status(uuid, timestamptz) from public, anon, authenticated, service_role;

create or replace function public.get_streak_shield()
returns jsonb language plpgsql volatile security definer set search_path = ''
as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'Authentication required'; end if;
  return public._streak_shield_status(u, pg_catalog.now());
end $$;
revoke all on function public.get_streak_shield() from public, anon;
grant execute on function public.get_streak_shield() to authenticated;

create or replace function public._couple_plain(p_text text, p_max integer)
returns text language sql immutable set search_path = ''
as $$
  select pg_catalog.left(pg_catalog.btrim(pg_catalog.regexp_replace(
    pg_catalog.regexp_replace(coalesce(p_text, ''), '<[^>]*>', '', 'g'),
    '[^A-Za-z0-9 ''&.,-]', '', 'g')), p_max)
$$;
revoke all on function public._couple_plain(text, integer) from public, anon, authenticated, service_role;

create or replace function public._couple_period(p_cadence text, p_day date)
returns date language sql immutable set search_path = ''
as $$
  select case
    when p_cadence = 'weekly' then public.quest_week_start(p_day)
    when p_cadence = 'monthly' then pg_catalog.date_trunc('month', p_day)::date
    else date '0001-01-01'
  end
$$;
revoke all on function public._couple_period(text, date) from public, anon, authenticated, service_role;

create or replace function public._couple_active_bond()
returns public.companion_bonds language plpgsql stable security definer set search_path = ''
as $$
declare u uuid := auth.uid(); b public.companion_bonds%rowtype;
begin
  if u is null then raise exception 'Sign-in required'; end if;
  select * into b from public.companion_bonds
    where status = 'active' and u in (inviter_id, companion_id)
    order by accepted_at desc nulls last, created_at desc
    limit 1;
  if not found or b.companion_id is null then raise exception 'Companion connection required'; end if;
  return b;
end $$;
revoke all on function public._couple_active_bond() from public, anon, authenticated, service_role;

create or replace function public.couple_add_quest_pack()
returns jsonb language plpgsql volatile security definer set search_path = ''
as $$
declare
  b public.companion_bonds%rowtype;
  v_added integer := 0;
  v_before integer;
begin
  b := public._couple_active_bond();
  select count(*) into v_before from public.couple_quests where bond_id = b.id;
  insert into public.couple_quests(bond_id, title, description, cadence, kind, title_key, created_by)
  select b.id, pack.title, pack.description, pack.cadence, 'shared', public.couple_title_key(pack.title), auth.uid()
  from (values
    ('Cook dinner together', 'Make a meal as a team, from preparation to cleanup.', 'weekly'),
    ('A walk without phones', 'Spend at least 20 minutes walking and talking without scrolling.', 'weekly'),
    ('Coffee date', 'Get coffee together and enjoy an uninterrupted conversation.', 'weekly'),
    ('Plan our next adventure', 'Choose one outing, date, or experience to look forward to.', 'weekly'),
    ('One thoughtful surprise', 'Do something small and unexpected for each other.', 'weekly'),
    ('Game night', 'Play a board game, video game, or card game together.', 'weekly'),
    ('Sunday reset', 'Spend 30 minutes getting your shared space ready for the week.', 'weekly'),
    ('Try something new', 'Visit somewhere new or try an activity neither of you has done together.', 'monthly'),
    ('At-home movie night', 'Choose a movie, prepare snacks, and watch it together.', 'weekly'),
    ('Make a shared playlist', 'Pick songs that remind you of each other or a shared memory.', 'monthly'),
    ('Memory lane', 'Look through old photos and share favorite memories.', 'monthly'),
    ('Workout together', 'Complete a walk, gym session, yoga class, or workout as a pair.', 'weekly'),
    ('A real check-in', 'Talk about what went well this week and what support would help.', 'weekly'),
    ('Call someone we love', 'Together, reach out to a family member or friend.', 'weekly'),
    ('Our next chapter', 'Write down one shared goal and the next small step toward it.', 'monthly')
  ) as pack(title, description, cadence)
  where not exists (
    select 1 from public.couple_quests q
    where q.bond_id = b.id and q.title_key = public.couple_title_key(pack.title)
  );
  get diagnostics v_added = row_count;
  return pg_catalog.jsonb_build_object(
    'added', v_added,
    'skipped', 15 - v_added,
    'total', (select count(*) from public.couple_quests where bond_id = b.id),
    'before', v_before);
end $$;
revoke all on function public.couple_add_quest_pack() from public, anon;
grant execute on function public.couple_add_quest_pack() to authenticated;

create or replace function public.couple_quest_create(p_title text, p_description text, p_cadence text)
returns uuid language plpgsql volatile security definer set search_path = ''
as $$
declare
  b public.companion_bonds%rowtype;
  v_title text := public._couple_plain(p_title, 120);
  v_note text := nullif(public._couple_plain(coalesce(p_description, ''), 500), '');
  v_cadence text := case when p_cadence in ('weekly', 'monthly', 'once') then p_cadence else null end;
  v_id uuid;
begin
  b := public._couple_active_bond();
  if v_title is null or char_length(v_title) < 1 or v_cadence is null then
    raise exception 'Invalid quest';
  end if;
  if exists (
    select 1 from public.couple_quests q
    where q.bond_id = b.id and q.title_key = public.couple_title_key(v_title)
  ) then
    raise exception 'Duplicate title';
  end if;
  insert into public.couple_quests(bond_id, title, description, cadence, kind, title_key, created_by)
  values (b.id, v_title, v_note, v_cadence, 'shared', public.couple_title_key(v_title), auth.uid())
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.couple_quest_create(text, text, text) from public, anon;
grant execute on function public.couple_quest_create(text, text, text) to authenticated;

create or replace function public.couple_create_date_night(
  p_title text, p_steps text[], p_weekday integer, p_hour integer, p_minute integer)
returns uuid language plpgsql volatile security definer set search_path = ''
as $$
declare
  b public.companion_bonds%rowtype;
  v_title text;
  v_step text;
  v_steps text[] := array[]::text[];
  v_id uuid;
  v_tz text;
  v_local timestamp;
  v_date date;
  v_due timestamptz;
  v_pos integer := 0;
  v_seen text[] := array[]::text[];
begin
  b := public._couple_active_bond();
  if p_steps is null or pg_catalog.cardinality(p_steps) < 2 or pg_catalog.cardinality(p_steps) > 5 then
    raise exception 'Invalid date night';
  end if;
  if p_weekday is null or p_weekday < 1 or p_weekday > 7
     or p_hour is null or p_hour < 0 or p_hour > 23
     or p_minute is null or p_minute < 0 or p_minute > 59 then
    raise exception 'Invalid date night';
  end if;
  foreach v_step in array p_steps loop
    v_step := public._couple_plain(v_step, 120);
    if v_step is null or char_length(v_step) < 1 then raise exception 'Invalid date night'; end if;
    if public.couple_title_key(v_step) = any (v_seen) then continue; end if;
    v_seen := v_seen || public.couple_title_key(v_step);
    v_steps := v_steps || v_step;
  end loop;
  if pg_catalog.cardinality(v_steps) < 2 or pg_catalog.cardinality(v_steps) > 5 then
    raise exception 'Invalid date night';
  end if;
  v_title := public._couple_plain(p_title, 120);
  if v_title is null or char_length(v_title) < 1 then raise exception 'Invalid date night'; end if;
  if exists (
    select 1 from public.couple_quests q
    where q.bond_id = b.id and q.title_key = public.couple_title_key(v_title)
  ) then
    raise exception 'Duplicate title';
  end if;
  v_tz := public.quest_timezone(b.inviter_id);
  v_local := pg_catalog.now() at time zone v_tz;
  v_date := v_local::date;
  while pg_catalog.date_part('isodow', v_date)::integer <> p_weekday loop
    v_date := v_date + 1;
  end loop;
  v_due := (v_date::timestamp + pg_catalog.make_interval(hours => p_hour, mins => p_minute)) at time zone v_tz;
  if v_due <= pg_catalog.now() then
    v_due := ((v_date + 7)::timestamp + pg_catalog.make_interval(hours => p_hour, mins => p_minute)) at time zone v_tz;
  end if;
  insert into public.couple_quests(bond_id, title, description, cadence, kind, title_key, due_at, created_by)
  values (b.id, v_title, null, 'once', 'date_night', public.couple_title_key(v_title), v_due, auth.uid())
  returning id into v_id;
  foreach v_step in array v_steps loop
    v_pos := v_pos + 1;
    insert into public.couple_quest_steps(quest_id, position, title)
    values (v_id, v_pos, v_step);
  end loop;
  return v_id;
end $$;
revoke all on function public.couple_create_date_night(text, text[], integer, integer, integer) from public, anon;
grant execute on function public.couple_create_date_night(text, text[], integer, integer, integer) to authenticated;

create or replace function public.couple_step_done(p_step uuid)
returns jsonb language plpgsql volatile security definer set search_path = ''
as $$
declare
  b public.companion_bonds%rowtype;
  step public.couple_quest_steps%rowtype;
begin
  b := public._couple_active_bond();
  select st.* into step from public.couple_quest_steps st
    join public.couple_quests q on q.id = st.quest_id
    where st.id = p_step and q.bond_id = b.id
    for update of st;
  if not found then raise exception 'Quest not found'; end if;
  if step.done_at is null then
    update public.couple_quest_steps set done_at = pg_catalog.now(), done_by = auth.uid() where id = step.id;
  end if;
  return pg_catalog.jsonb_build_object('done', true, 'xp', 0);
end $$;
revoke all on function public.couple_step_done(uuid) from public, anon;
grant execute on function public.couple_step_done(uuid) to authenticated;

create or replace function public.couple_quest_mark(p_quest uuid)
returns jsonb language plpgsql volatile security definer set search_path = ''
as $$
declare
  u uuid := auth.uid();
  b public.companion_bonds%rowtype;
  q public.couple_quests%rowtype;
  v_tz text;
  v_day date;
  v_period date;
  v_ready boolean;
  v_quest uuid;
  v_inst uuid;
  v_award jsonb;
  v_izzy integer := 0;
  v_ledger uuid;
  v_amount integer;
begin
  if u is null then raise exception 'Sign-in required'; end if;
  b := public._couple_active_bond();
  select * into q from public.couple_quests where id = p_quest and bond_id = b.id for update;
  if not found then raise exception 'Quest not found'; end if;
  v_tz := public.quest_timezone(b.inviter_id);
  v_day := public.quest_game_day(pg_catalog.now(), v_tz);
  v_period := public._couple_period(q.cadence, v_day);
  insert into public.couple_quest_marks(quest_id, period_key, user_id)
  values (q.id, v_period, u)
  on conflict (quest_id, period_key, user_id) do nothing;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('couple-award:' || q.id::text || ':' || v_period::text, 0));
  v_ready := exists (
      select 1 from public.couple_quest_marks m
      where m.quest_id = q.id and m.period_key = v_period and m.user_id = b.inviter_id)
    and exists (
      select 1 from public.couple_quest_marks m
      where m.quest_id = q.id and m.period_key = v_period and m.user_id = b.companion_id);
  if not v_ready then
    return pg_catalog.jsonb_build_object('awarded', false, 'already', false, 'connorXp', 0, 'izzyXp', 0, 'period', v_period);
  end if;
  if exists (
    select 1 from public.couple_quest_awards a where a.quest_id = q.id and a.period_key = v_period
  ) then
    return pg_catalog.jsonb_build_object('awarded', false, 'already', true, 'connorXp', 0, 'izzyXp', 0, 'period', v_period);
  end if;
  insert into public.quests(owner_id, title, domain, cadence, scheduled_for, quest_type)
  values (b.inviter_id, q.title, 'relationships', 'once', v_day, 'scheduled')
  returning id into v_quest;
  insert into public.quest_instances(owner_id, quest_id, due_date, status, completed_at)
  values (b.inviter_id, v_quest, v_day, 'completed', pg_catalog.now())
  returning id into v_inst;
  v_award := public._award_personal_quest_xp(b.inviter_id, v_inst);
  if coalesce((v_award->>'awarded')::boolean, false) is not true then
    raise exception 'Quest XP award missing';
  end if;
  v_amount := public.couple_companion_xp();
  if v_amount > 0 then
    insert into public.companion_xp_ledger(owner_id, bond_id, amount, source_key, reason)
    values (b.companion_id, b.id, v_amount, 'couple:' || q.id::text || ':' || v_period::text, 'couple_quest')
    on conflict (source_key) do nothing
    returning id into v_ledger;
    if v_ledger is not null then v_izzy := v_amount; end if;
  end if;
  insert into public.couple_quest_awards(
    quest_id, period_key, bond_id, personal_quest_id, instance_id, companion_ledger_id, companion_xp)
  values (q.id, v_period, b.id, v_quest, v_inst, v_ledger, v_izzy);
  insert into public.quest_events(owner_id, instance_id, event_type)
  values (b.inviter_id, v_inst, 'completed');
  return pg_catalog.jsonb_build_object(
    'awarded', true, 'already', false,
    'connorXp', coalesce((v_award->>'amount')::integer, 0),
    'izzyXp', v_izzy,
    'firstOfDay', v_award->'first_of_day',
    'fire', v_award->'fire',
    'period', v_period);
end $$;
revoke all on function public.couple_quest_mark(uuid) from public, anon;
grant execute on function public.couple_quest_mark(uuid) to authenticated;

create or replace function public.couple_board()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  u uuid := auth.uid();
  b public.companion_bonds%rowtype;
  v_tz text;
  v_day date;
begin
  b := public._couple_active_bond();
  u := auth.uid();
  v_tz := public.quest_timezone(b.inviter_id);
  v_day := public.quest_game_day(pg_catalog.now(), v_tz);
  return pg_catalog.jsonb_build_object(
    'role', case when b.inviter_id = u then 'adventurer' else 'companion' end,
    'companionXp', public.couple_companion_xp(),
    'gameDay', v_day,
    'quests', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', q.id,
        'title', q.title,
        'description', q.description,
        'cadence', q.cadence,
        'kind', q.kind,
        'dueAt', q.due_at,
        'myDone', exists (
          select 1 from public.couple_quest_marks m
          where m.quest_id = q.id and m.user_id = u
            and m.period_key = public._couple_period(q.cadence, v_day)),
        'partnerDone', exists (
          select 1 from public.couple_quest_marks m
          where m.quest_id = q.id
            and m.user_id = case when b.inviter_id = u then b.companion_id else b.inviter_id end
            and m.period_key = public._couple_period(q.cadence, v_day)),
        'awarded', exists (
          select 1 from public.couple_quest_awards a
          where a.quest_id = q.id and a.period_key = public._couple_period(q.cadence, v_day)),
        'steps', coalesce((
          select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
            'id', st.id, 'position', st.position, 'title', st.title, 'done', st.done_at is not null
          ) order by st.position)
          from public.couple_quest_steps st where st.quest_id = q.id
        ), '[]'::jsonb)
      ) order by q.created_at)
      from public.couple_quests q where q.bond_id = b.id
    ), '[]'::jsonb));
end $$;
revoke all on function public.couple_board() from public, anon;
grant execute on function public.couple_board() to authenticated;

create or replace function public._companion_streak_at(p_owner uuid, p_bond uuid, p_today date, p_tz text)
returns integer language plpgsql stable set search_path = ''
as $$
declare d date := p_today - 1; n integer := 0; guard integer := 0;
begin
  while guard < 4000 loop
    guard := guard + 1;
    if exists (
      select 1 from public.companion_xp_ledger l
      where l.owner_id = p_owner and l.bond_id = p_bond
        and public.quest_game_day(l.created_at, p_tz) = d
    ) or exists (
      select 1 from public.companion_activities a
      where a.subject_id = p_owner and a.bond_id = p_bond and a.voided_at is null
        and public.quest_game_day(a.created_at, p_tz) = d
    ) then
      n := n + 1;
      d := d - 1;
    else
      exit;
    end if;
  end loop;
  return n;
end $$;
revoke all on function public._companion_streak_at(uuid, uuid, date, text) from public, anon, authenticated, service_role;

create or replace function public._couple_weekly_recap_at(p_at timestamptz)
returns jsonb language plpgsql volatile security definer set search_path = ''
as $$
declare
  u uuid := auth.uid();
  b public.companion_bonds%rowtype;
  v_tz text;
  v_today date;
  v_week date;
  v_start timestamptz;
  v_end timestamptz;
  v_i integer;
  v_best integer;
  v_len integer;
  v_connor_done integer;
  v_connor_xp integer;
  v_connor_life bigint;
  v_izzy_done integer;
  v_izzy_xp integer;
  v_izzy_life bigint;
  v_izzy_best integer;
begin
  if u is null then raise exception 'Sign-in required'; end if;
  if p_at is null then raise exception 'Invalid recap'; end if;
  select * into b from public.companion_bonds
    where status = 'active' and u in (inviter_id, companion_id)
    order by accepted_at desc nulls last, created_at desc
    limit 1;
  if not found or b.companion_id is null then
    raise exception 'Companion connection required';
  end if;
  -- Approved clock is America/Chicago, not the profile zone.
  v_tz := 'America/Chicago';
  v_today := public.quest_game_day(p_at, v_tz);
  if pg_catalog.date_part('isodow', v_today) <> 7 then
    return pg_catalog.jsonb_build_object(
      'visible', false, 'weekStart', null, 'weekEnd', null, 'timeZone', v_tz, 'partners', '[]'::jsonb);
  end if;
  -- Previous Sunday 05:00 inclusive, this Sunday 05:00 exclusive.
  v_week := v_today - 7;
  v_start := ((v_week::timestamp + interval '5 hours') at time zone v_tz);
  v_end := ((v_today::timestamp + interval '5 hours') at time zone v_tz);
  v_best := 0;
  for v_i in 0..6 loop
    v_len := public._quest_streak_fire_at(b.inviter_id, v_week + v_i + 1, v_tz);
    if v_len > v_best then v_best := v_len; end if;
  end loop;
  select count(*) filter (where net > 0), coalesce(sum(net) filter (where net > 0), 0)
    into v_connor_done, v_connor_xp
  from (
    select l.amount + coalesce((select sum(a.amount) from public.xp_ledger_adjustments a where a.ledger_id = l.id), 0) as net
    from public.xp_ledger l
    where l.owner_id = b.inviter_id and l.awarded_at >= v_start and l.awarded_at < v_end
  ) rows;
  select (
    coalesce((select sum(amount) from public.xp_ledger where owner_id = b.inviter_id), 0)
    + coalesce((select sum(amount) from public.xp_ledger_adjustments where owner_id = b.inviter_id), 0)
  ) into v_connor_life;
  select count(*) into v_izzy_done from (
    select a.id from public.companion_activities a
      where a.bond_id = b.id and a.subject_id = b.companion_id and a.voided_at is null
        and a.created_at >= v_start and a.created_at < v_end
    union all
    select aw.id from public.couple_quest_awards aw
      where aw.bond_id = b.id and aw.created_at >= v_start and aw.created_at < v_end
  ) done_rows;
  select coalesce(sum(amount), 0) into v_izzy_xp from public.companion_xp_ledger l
    where l.owner_id = b.companion_id and l.bond_id = b.id
      and l.created_at >= v_start and l.created_at < v_end;
  select coalesce(sum(amount), 0) into v_izzy_life from public.companion_xp_ledger l
    where l.owner_id = b.companion_id and l.bond_id = b.id;
  v_izzy_best := 0;
  for v_i in 0..6 loop
    v_len := public._companion_streak_at(b.companion_id, b.id, v_week + v_i + 1, v_tz);
    if v_len > v_izzy_best then v_izzy_best := v_len; end if;
  end loop;
  return pg_catalog.jsonb_build_object(
    'visible', true,
    'weekStart', v_week,
    'weekEnd', v_today,
    'timeZone', v_tz,
    'partners', pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'role', 'adventurer',
        'userId', b.inviter_id,
        'done', v_connor_done,
        'xp', v_connor_xp,
        'levelsGained', public.profile_level(v_connor_life) - public.profile_level(v_connor_life - v_connor_xp),
        'longestStreak', v_best),
      pg_catalog.jsonb_build_object(
        'role', 'companion',
        'userId', b.companion_id,
        'done', v_izzy_done,
        'xp', v_izzy_xp,
        'levelsGained', public.profile_level(v_izzy_life) - public.profile_level(v_izzy_life - v_izzy_xp),
        'longestStreak', v_izzy_best)));
end $$;
revoke all on function public._couple_weekly_recap_at(timestamptz) from public, anon, authenticated, service_role;

create or replace function public.couple_weekly_recap()
returns jsonb language sql volatile security definer set search_path = ''
as $$ select public._couple_weekly_recap_at(pg_catalog.now()) $$;
revoke all on function public.couple_weekly_recap() from public, anon;
grant execute on function public.couple_weekly_recap() to authenticated;

notify pgrst, 'reload schema';
