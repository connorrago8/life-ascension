-- Pack v2 copy and catalogs. Reverse with supabase/rollbacks/202611120002_design_pack_v2_down.sql.
-- Apply to TEST only. Do not apply to production.
--
-- Pending founder sign-off (proposal defaults only):
--   couple_xp_config.recap_schedule = sunday_chicago_5am_previous_7
--   couple_xp_config.shield_month_reset = chicago_5am_on_the_1st
-- Izzy's couple-quest XP stays couple_xp_config.companion_xp (10), paid once.

alter table public.couple_xp_config
  add column if not exists recap_schedule text not null default 'sunday_chicago_5am_previous_7';
alter table public.couple_xp_config
  add column if not exists shield_month_reset text not null default 'chicago_5am_on_the_1st';

alter table public.couple_quests add column if not exists cost_tag text;
alter table public.couple_quests add column if not exists duration_tag text;
alter table public.couple_quests add column if not exists setting_tag text;
alter table public.couple_quests drop constraint if exists couple_quests_cost_tag_check;
alter table public.couple_quests add constraint couple_quests_cost_tag_check
  check (cost_tag is null or cost_tag in ('$', '$$', '$$$'));
alter table public.couple_quests drop constraint if exists couple_quests_duration_tag_check;
alter table public.couple_quests add constraint couple_quests_duration_tag_check
  check (duration_tag is null or duration_tag in ('short', 'evening', 'full_day'));
alter table public.couple_quests drop constraint if exists couple_quests_setting_tag_check;
alter table public.couple_quests add constraint couple_quests_setting_tag_check
  check (setting_tag is null or setting_tag in ('home', 'out'));

update public.couple_quests set description = flavor.description
from (values
  ('Cook dinner together', 'Turn ingredients and teamwork into a meal worth remembering.'),
  ('A walk without phones', 'Leave the noise behind and rediscover the art of talking.'),
  ('Coffee date', 'Share a warm drink and an unhurried hour.'),
  ('Plan our next adventure', 'Put a new pin on the map of your shared story.'),
  ('One thoughtful surprise', 'Make an ordinary day unexpectedly bright.'),
  ('Game night', 'Trade the day''s demands for a little friendly competition.'),
  ('Sunday reset', 'Restore your shared space before the next chapter begins.'),
  ('Try something new', 'Step outside the familiar and bring home a new memory.'),
  ('At-home movie night', 'Dim the lights and disappear into a story together.'),
  ('Make a shared playlist', 'Build a soundtrack only the two of you fully understand.'),
  ('Memory lane', 'Revisit the moments that brought you here.'),
  ('Workout together', 'Move side by side, at your own pace.'),
  ('A real check-in', 'Make room for the things that matter but rarely get said.'),
  ('Call someone we love', 'Keep a connection strong beyond your own front door.'),
  ('Our next chapter', 'Choose one shared goal and take its first small step.')
) as flavor(title, description)
where public.couple_quests.title = flavor.title;

create table if not exists public.date_night_ideas (
  id smallint primary key check (id between 1 and 30),
  title text not null unique check (char_length(btrim(title)) between 1 and 120),
  blurb text not null check (char_length(blurb) between 1 and 240),
  cost_tag text not null check (cost_tag in ('$', '$$', '$$$')),
  duration_tag text not null check (duration_tag in ('short', 'evening', 'full_day')),
  setting_tag text not null check (setting_tag in ('home', 'out'))
);
insert into public.date_night_ideas(id, title, blurb, cost_tag, duration_tag, setting_tag) values
  (1, 'Cook a new recipe together', 'Pick a dish neither of you has made and turn dinner into a shared experiment.', '$', 'evening', 'home'),
  (2, 'No-phone walk', 'Leave the scrolling behind and follow whichever street looks interesting.', '$', 'short', 'out'),
  (3, 'Candlelit takeout', 'Dress up your favorite delivery like a reservation for two.', '$$', 'evening', 'home'),
  (4, 'Board-game duel', 'Choose a game, invent a prize, and let friendly rivalry take over.', '$', 'evening', 'home'),
  (5, 'Sunset lookout', 'Find a view and stay until the city lights come on.', '$', 'short', 'out'),
  (6, 'Coffee-shop crawl', 'Split two drinks at two cafés and pick your favorite.', '$$', 'short', 'out'),
  (7, 'Build a shared playlist', 'Trade songs and tell the stories attached to them.', '$', 'short', 'home'),
  (8, 'Museum afternoon', 'Choose exhibits for each other and compare what caught your eye.', '$$', 'full_day', 'out'),
  (9, 'Make homemade pizza', 'Each design half a pizza, then trade slices.', '$', 'evening', 'home'),
  (10, 'Thrift-store challenge', 'Find each other the funniest useful item under a small budget.', '$', 'short', 'out'),
  (11, 'Backyard or living-room picnic', 'Lay out a blanket, snacks, and a little change of scenery.', '$', 'evening', 'home'),
  (12, 'Pottery or art class', 'Make imperfect keepsakes you''ll remember longer than the lesson.', '$$$', 'evening', 'out'),
  (13, 'Photo scavenger hunt', 'Find five textures, colors, or moments worth photographing together.', '$', 'short', 'out'),
  (14, 'Recreate your first date', 'Return to the details that started your story.', '$$', 'evening', 'out'),
  (15, 'Stargazing drive', 'Find darker skies, bring blankets, and name your own constellations.', '$', 'evening', 'out'),
  (16, 'Bookstore exchange', 'Choose a book for each other and explain why.', '$', 'short', 'out'),
  (17, 'At-home spa evening', 'Put on music, slow down, and make rest the plan.', '$', 'evening', 'home'),
  (18, 'Live jazz or small concert', 'Let someone else''s music set the pace for the night.', '$$$', 'evening', 'out'),
  (19, 'Neighborhood food tour', 'Share one small dish at each of three stops.', '$$', 'evening', 'out'),
  (20, 'Mini-golf rivalry', 'Compete for bragging rights, not a serious scorecard.', '$$', 'short', 'out'),
  (21, 'Bake something ambitious', 'Attempt a dessert that''s slightly beyond your usual comfort zone.', '$', 'evening', 'home'),
  (22, 'Day trip to a nearby town', 'Pick a destination and discover it one block at a time.', '$$', 'full_day', 'out'),
  (23, 'Rooftop dinner', 'Make an ordinary evening feel like an occasion.', '$$$', 'evening', 'out'),
  (24, 'Build a memory box', 'Gather tickets, notes, and photos from the moments you want to keep.', '$', 'evening', 'home'),
  (25, 'Farmers-market morning', 'Choose one ingredient and invent a meal around it.', '$', 'short', 'out'),
  (26, 'Arcade night', 'Trade tokens, challenge each other, and laugh at the high scores.', '$$', 'evening', 'out'),
  (27, 'Movie marathon with a theme', 'Pick a genre, make matching snacks, and settle in.', '$', 'evening', 'home'),
  (28, 'Botanical garden wander', 'Spend a slow day somewhere green and unfamiliar.', '$$', 'full_day', 'out'),
  (29, 'Hotel staycation', 'Explore your own city as though you''ve just arrived.', '$$$', 'full_day', 'out'),
  (30, 'Plan a dream trip', 'Build a fantasy itinerary, then choose one affordable piece to make real.', '$', 'evening', 'home')
on conflict (id) do update set
  title = excluded.title, blurb = excluded.blurb, cost_tag = excluded.cost_tag,
  duration_tag = excluded.duration_tag, setting_tag = excluded.setting_tag;
alter table public.date_night_ideas enable row level security;
drop policy if exists date_night_ideas_read on public.date_night_ideas;
create policy date_night_ideas_read on public.date_night_ideas for select to authenticated using (true);
revoke all on public.date_night_ideas from public, anon, authenticated;
grant select on public.date_night_ideas to authenticated;

create or replace function public.couple_add_quest_pack()
returns jsonb language plpgsql volatile security definer set search_path = ''
as $$
declare b public.companion_bonds%rowtype; v_added integer := 0; v_before integer;
begin
  b := public._couple_active_bond();
  select count(*) into v_before from public.couple_quests where bond_id = b.id;
  insert into public.couple_quests(bond_id, title, description, cadence, kind, title_key, created_by)
  select b.id, pack.title, pack.description, pack.cadence, 'shared', public.couple_title_key(pack.title), auth.uid()
  from (values
    ('Cook dinner together', 'Turn ingredients and teamwork into a meal worth remembering.', 'weekly'),
    ('A walk without phones', 'Leave the noise behind and rediscover the art of talking.', 'weekly'),
    ('Coffee date', 'Share a warm drink and an unhurried hour.', 'weekly'),
    ('Plan our next adventure', 'Put a new pin on the map of your shared story.', 'weekly'),
    ('One thoughtful surprise', 'Make an ordinary day unexpectedly bright.', 'weekly'),
    ('Game night', 'Trade the day''s demands for a little friendly competition.', 'weekly'),
    ('Sunday reset', 'Restore your shared space before the next chapter begins.', 'weekly'),
    ('Try something new', 'Step outside the familiar and bring home a new memory.', 'monthly'),
    ('At-home movie night', 'Dim the lights and disappear into a story together.', 'weekly'),
    ('Make a shared playlist', 'Build a soundtrack only the two of you fully understand.', 'monthly'),
    ('Memory lane', 'Revisit the moments that brought you here.', 'monthly'),
    ('Workout together', 'Move side by side, at your own pace.', 'weekly'),
    ('A real check-in', 'Make room for the things that matter but rarely get said.', 'weekly'),
    ('Call someone we love', 'Keep a connection strong beyond your own front door.', 'weekly'),
    ('Our next chapter', 'Choose one shared goal and take its first small step.', 'monthly')
  ) as pack(title, description, cadence)
  where not exists (
    select 1 from public.couple_quests q
    where q.bond_id = b.id and q.title_key = public.couple_title_key(pack.title)
  );
  get diagnostics v_added = row_count;
  return pg_catalog.jsonb_build_object('added', v_added, 'skipped', 15 - v_added,
    'total', (select count(*) from public.couple_quests where bond_id = b.id), 'before', v_before);
end $$;
revoke all on function public.couple_add_quest_pack() from public, anon;
grant execute on function public.couple_add_quest_pack() to authenticated;

create or replace function public.couple_choose_date_idea(p_id integer)
returns uuid language plpgsql volatile security definer set search_path = ''
as $$
declare
  b public.companion_bonds%rowtype;
  idea public.date_night_ideas%rowtype;
  v_id uuid;
begin
  b := public._couple_active_bond();
  select * into idea from public.date_night_ideas where id = p_id;
  if not found then raise exception 'Date idea not found'; end if;
  if exists (
    select 1 from public.couple_quests q
    where q.bond_id = b.id and q.title_key = public.couple_title_key(idea.title)
  ) then
    raise exception 'Duplicate title';
  end if;
  insert into public.couple_quests(
    bond_id, title, description, cadence, kind, title_key, created_by, cost_tag, duration_tag, setting_tag)
  values (
    b.id, idea.title, idea.blurb, 'once', 'date_night', public.couple_title_key(idea.title), auth.uid(),
    idea.cost_tag, idea.duration_tag, idea.setting_tag)
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.couple_choose_date_idea(integer) from public, anon;
grant execute on function public.couple_choose_date_idea(integer) to authenticated;

-- Legacy internal name retained for callers; calculation is strictly read-only.
create or replace function public._streak_shield_sync(p_owner uuid, p_today date, p_tz text)
returns integer language sql stable security definer set search_path = ''
as $$ select public._quest_streak_fire_at(p_owner, p_today, p_tz) $$;
revoke all on function public._streak_shield_sync(uuid, date, text) from public, anon, authenticated, service_role;

create or replace function public._streak_shield_status(p_owner uuid, p_at timestamptz)
returns jsonb language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_today date;
  v_month date;
  v_day date;
  v_notice text;
  v_candidate date;
  v_cursor date;
begin
  if p_owner is null or p_at is null then raise exception 'Authentication required'; end if;
  v_today := public.quest_game_day(p_at, 'America/Chicago');
  -- Read-only status. No implicit shield consumption.
  v_month := public.streak_shield_month(p_at);
  select s.bridged_day into v_day from public.streak_shields s
    where s.owner_id = p_owner and s.month_key = v_month;
  if v_day is null then
    -- Walk the currently connected run; only offer a real one-day gap in
    -- the active allowance month. Merely reading this never writes a receipt.
    v_cursor := v_today - 1;
    while v_cursor >= v_month loop
      if public.quest_has_completion_on(p_owner, v_cursor, 'America/Chicago') then
        v_cursor := v_cursor - 1;
        continue;
      end if;
      if public.quest_has_completion_on(p_owner, v_cursor - 1, 'America/Chicago')
         and public.quest_has_completion_on(p_owner, v_cursor + 1, 'America/Chicago') then
        v_candidate := v_cursor;
      end if;
      exit;
    end loop;
    v_notice := 'Streak Shield ready · 1 this month';
  else
    v_notice := 'Streak Shield used · 0 remaining. Streak protected. You missed a day, but your journey continues. No XP was awarded.';
  end if;
  return pg_catalog.jsonb_build_object(
    'status', case when v_day is null then 'ready' else 'used' end,
    'month', v_month,
    'bridgedDay', v_day,
    'eligibleMissedDay', v_candidate,
    'doneToday', public.quest_has_completion_on(p_owner, v_today, 'America/Chicago'),
    'notice', v_notice);
end $$;
revoke all on function public._streak_shield_status(uuid, timestamptz) from public, anon, authenticated, service_role;

create or replace function public._couple_weekly_recap_at(p_at timestamptz)
returns jsonb language plpgsql volatile security definer set search_path = ''
as $$
declare
  u uuid := auth.uid();
  b public.companion_bonds%rowtype;
  v_schedule text;
  v_tz text := 'America/Chicago';
  v_today date;
  v_week date;
  v_start timestamptz;
  v_end timestamptz;
  v_i integer;
  v_best integer := 0;
  v_len integer;
  v_connor_done integer := 0;
  v_connor_xp integer := 0;
  v_connor_life bigint := 0;
  v_izzy_done integer := 0;
  v_izzy_xp integer := 0;
  v_izzy_life bigint := 0;
  v_izzy_best integer := 0;
  v_couple integer := 0;
  v_moment text;
  v_highlight text;
  v_next text;
begin
  if u is null then raise exception 'Sign-in required'; end if;
  if p_at is null then raise exception 'Invalid recap'; end if;
  select * into b from public.companion_bonds
    where status = 'active' and u in (inviter_id, companion_id)
    order by accepted_at desc nulls last, created_at desc
    limit 1;
  if not found or b.companion_id is null then raise exception 'Companion connection required'; end if;
  select recap_schedule into v_schedule from public.couple_xp_config where singleton;
  if v_schedule is distinct from 'sunday_chicago_5am_previous_7' then
    return pg_catalog.jsonb_build_object(
      'visible', false, 'pending', true, 'schedule', v_schedule,
      'weekStart', null, 'weekEnd', null, 'timeZone', v_tz, 'partners', '[]'::jsonb);
  end if;
  v_today := public.quest_game_day(p_at, v_tz);
  if pg_catalog.date_part('isodow', v_today) <> 7 then
    return pg_catalog.jsonb_build_object(
      'visible', false, 'pending', true, 'schedule', v_schedule,
      'weekStart', null, 'weekEnd', null, 'timeZone', v_tz, 'partners', '[]'::jsonb);
  end if;
  v_week := v_today - 7;
  v_start := ((v_week::timestamp + interval '5 hours') at time zone v_tz);
  v_end := ((v_today::timestamp + interval '5 hours') at time zone v_tz);
  for v_i in 0..6 loop
    v_len := public._quest_streak_fire_at(b.inviter_id, v_week + v_i + 1, v_tz);
    if v_len > v_best then v_best := v_len; end if;
    v_len := public._companion_streak_at(b.companion_id, b.id, v_week + v_i + 1, v_tz);
    if v_len > v_izzy_best then v_izzy_best := v_len; end if;
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
  select coalesce(sum(amount), 0), coalesce((select sum(amount) from public.companion_xp_ledger where owner_id = b.companion_id and bond_id = b.id), 0)
    into v_izzy_xp, v_izzy_life
  from public.companion_xp_ledger l
  where l.owner_id = b.companion_id and l.bond_id = b.id and l.created_at >= v_start and l.created_at < v_end;
  select count(*) into v_couple from public.couple_quest_awards aw
    where aw.bond_id = b.id and aw.created_at >= v_start and aw.created_at < v_end;
  select s.title into v_moment from (
    select a.title, a.created_at from public.companion_activities a
      where a.bond_id = b.id and a.voided_at is null and a.created_at >= v_start and a.created_at < v_end
    union all
    select q.title, aw.created_at from public.couple_quest_awards aw
      join public.couple_quests q on q.id = aw.quest_id
      where aw.bond_id = b.id and aw.created_at >= v_start and aw.created_at < v_end
  ) s order by s.created_at desc limit 1;
  select q.title into v_highlight from public.couple_quest_awards aw
    join public.couple_quests q on q.id = aw.quest_id
    where aw.bond_id = b.id and aw.created_at >= v_start and aw.created_at < v_end
    order by aw.created_at desc limit 1;
  select q.title into v_next from public.couple_quests q
    where q.bond_id = b.id
      and not exists (
        select 1 from public.couple_quest_awards aw
        where aw.quest_id = q.id and aw.created_at >= v_start and aw.created_at < v_end
      )
    order by q.created_at limit 1;
  return pg_catalog.jsonb_build_object(
    'visible', true,
    'pending', true,
    'schedule', v_schedule,
    'weekStart', v_week,
    'weekEnd', v_today,
    'timeZone', v_tz,
    'coupleQuestsCompleted', v_couple,
    'bestMomentTitle', v_moment,
    'coupleQuestTitle', v_highlight,
    'unlockNames', '[]'::jsonb,
    'nextQuestTitle', v_next,
    'partners', pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'role', 'adventurer', 'userId', b.inviter_id, 'done', v_connor_done, 'xp', v_connor_xp,
        'level', public.profile_level(v_connor_life),
        'levelsGained', public.profile_level(v_connor_life) - public.profile_level(v_connor_life - v_connor_xp),
        'longestStreak', v_best),
      pg_catalog.jsonb_build_object(
        'role', 'companion', 'userId', b.companion_id, 'done', v_izzy_done, 'xp', v_izzy_xp,
        'level', public.profile_level(v_izzy_life),
        'levelsGained', public.profile_level(v_izzy_life) - public.profile_level(v_izzy_life - v_izzy_xp),
        'longestStreak', v_izzy_best)));
end $$;
revoke all on function public._couple_weekly_recap_at(timestamptz) from public, anon, authenticated, service_role;

notify pgrst, 'reload schema';
