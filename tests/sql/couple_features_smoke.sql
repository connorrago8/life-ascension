-- Couple quests, date night, weekly recap, and streak shield. Disposable database only.
\set ON_ERROR_STOP on

do $$ begin
  assert (select companion_xp from public.couple_xp_config where singleton) = 10, 'Izzy default is 10';
  assert (select recap_schedule from public.couple_xp_config where singleton) = 'sunday_chicago_5am_previous_7';
  assert (select shield_month_reset from public.couple_xp_config where singleton) = 'chicago_5am_on_the_1st';
  assert (select count(*) from public.date_night_ideas) = 30;
  assert not has_function_privilege('anon', 'public.couple_quest_mark(uuid)', 'execute');
  assert not has_function_privilege('authenticated', 'public._award_personal_quest_xp(uuid,uuid)', 'execute');
  assert not has_table_privilege('authenticated', 'public.couple_quests', 'insert');
  assert not has_table_privilege('authenticated', 'public.companion_xp_ledger', 'insert');
  assert not has_table_privilege('authenticated', 'public.streak_shields', 'insert');\n  assert has_function_privilege('authenticated', 'public.confirm_streak_shield(date)', 'execute');\n  assert not has_function_privilege('anon', 'public.confirm_streak_shield(date)', 'execute');
end $$;

create or replace function pg_temp.seed_day(p_owner uuid, p_day date, p_hour integer default 12) returns void language plpgsql as $$
begin
  perform pg_temp.seed_instant(p_owner, (p_day::timestamp + make_interval(hours => p_hour)) at time zone 'America/Chicago');
end $$;

create or replace function pg_temp.seed_instant(p_owner uuid, p_at timestamptz) returns void language plpgsql as $$
declare q uuid := gen_random_uuid(); i uuid := gen_random_uuid(); v_day date;
begin
  v_day := public.quest_game_day(p_at, 'America/Chicago');
  insert into public.quests(id, owner_id, title, domain, cadence, scheduled_for, quest_type)
  values (q, p_owner, 'history ' || p_at::text, 'home', 'once', v_day, 'scheduled');
  insert into public.quest_instances(id, owner_id, quest_id, due_date, status, completed_at)
  values (i, p_owner, q, v_day, 'completed', p_at);
  insert into public.xp_ledger(owner_id, instance_id, amount, awarded_at)
  values (p_owner, i, 10, p_at);
end $$;

insert into auth.users(id) values
  ('00000000-0000-0000-0000-00000000c401'),
  ('00000000-0000-0000-0000-00000000c402'),
  ('00000000-0000-0000-0000-00000000c403'),
  ('00000000-0000-0000-0000-00000000c404'),
  ('00000000-0000-0000-0000-00000000c405'),
  ('00000000-0000-0000-0000-00000000c406'),
  ('00000000-0000-0000-0000-00000000c407'),
  ('00000000-0000-0000-0000-00000000c408');

-- 04:59 belongs to the previous game day. 05:00 opens the new one. Shield follows that boundary.
do $$
declare
  early uuid := '00000000-0000-0000-0000-00000000c404';
  later uuid := '00000000-0000-0000-0000-00000000c405';
  q uuid; i uuid; before_xp integer; after_xp integer;
begin
  perform pg_temp.seed_day(early, '2026-03-12');
  q := gen_random_uuid(); i := gen_random_uuid();
  insert into public.quests(id, owner_id, title, domain, cadence, scheduled_for, quest_type)
    values (q, early, 'edge early', 'home', 'once', '2026-03-13', 'scheduled');
  insert into public.quest_instances(id, owner_id, quest_id, due_date, status, completed_at)
    values (i, early, q, '2026-03-13', 'completed', '2026-03-14 04:59:00 America/Chicago');
  insert into public.xp_ledger(owner_id, instance_id, amount, awarded_at)
    values (early, i, 10, '2026-03-14 04:59:00 America/Chicago');
  select coalesce(sum(amount), 0) into before_xp from public.xp_ledger where owner_id = early;
  assert public.quest_has_completion_on(early, '2026-03-13', 'America/Chicago'), '04:59 counts for the previous game day';
  assert not public.quest_has_completion_on(early, '2026-03-14', 'America/Chicago'), '04:59 is not the new game day';
  assert public.quest_streak_fire(early, '2026-03-14', 'America/Chicago') = 2, 'no gap across 04:59';
  assert not exists (select 1 from public.streak_shields where owner_id = early), 'no shield when the day was completed';
  select coalesce(sum(amount), 0) into after_xp from public.xp_ledger where owner_id = early;
  assert before_xp = after_xp, 'shield math must not change XP already awarded';

  perform pg_temp.seed_day(later, '2026-03-12');
  q := gen_random_uuid(); i := gen_random_uuid();
  insert into public.quests(id, owner_id, title, domain, cadence, scheduled_for, quest_type)
    values (q, later, 'edge five', 'home', 'once', '2026-03-14', 'scheduled');
  insert into public.quest_instances(id, owner_id, quest_id, due_date, status, completed_at)
    values (i, later, q, '2026-03-14', 'completed', '2026-03-14 05:00:00 America/Chicago');
  insert into public.xp_ledger(owner_id, instance_id, amount, awarded_at)
    values (later, i, 10, '2026-03-14 05:00:00 America/Chicago');
  select coalesce(sum(amount), 0) into before_xp from public.xp_ledger where owner_id = later;
  assert public.quest_has_completion_on(later, '2026-03-14', 'America/Chicago'), '05:00 opens the game day';
  assert not public.quest_has_completion_on(later, '2026-03-13', 'America/Chicago');
  assert public.quest_streak_fire(later, '2026-03-15', 'America/Chicago') = 1, 'unconfirmed gap does not bridge';
  assert exists (
    select 1 from public.streak_shields
    where owner_id = later and month_key = '2026-03-01' and bridged_day = '2026-03-13'
  ), 'March shield used on the empty game day';
  select coalesce(sum(amount), 0) into after_xp from public.xp_ledger where owner_id = later;
  assert before_xp = after_xp and (select count(*) from public.xp_ledger where owner_id = later) = 2;
end $$;

-- One miss is saved. Two misses are not. A month holds a single shield.
do $$
declare one uuid := '00000000-0000-0000-0000-00000000c406';
  two uuid := '00000000-0000-0000-0000-00000000c407';
  roll uuid := '00000000-0000-0000-0000-00000000c408';
  before_xp integer;
begin
  perform pg_temp.seed_day(one, '2026-04-10');
  perform pg_temp.seed_day(one, '2026-04-12');
  select coalesce(sum(amount), 0) into before_xp from public.xp_ledger where owner_id = one;
  assert public.quest_streak_fire(one, '2026-04-13', 'America/Chicago') = 2, 'missed one day';
  assert (select bridged_day from public.streak_shields where owner_id = one) = '2026-04-11';
  assert (select coalesce(sum(amount), 0) from public.xp_ledger where owner_id = one) = before_xp;

  perform pg_temp.seed_day(two, '2026-04-10');
  perform pg_temp.seed_day(two, '2026-04-13');
  assert public.quest_streak_fire(two, '2026-04-14', 'America/Chicago') = 1, 'missed two days';
  assert not exists (select 1 from public.streak_shields where owner_id = two);

  perform pg_temp.seed_day(roll, '2026-01-29');
  perform pg_temp.seed_day(roll, '2026-01-31');
  perform pg_temp.seed_day(roll, '2026-02-01');
  perform pg_temp.seed_day(roll, '2026-02-03');
  assert public.quest_streak_fire(roll, '2026-02-04', 'America/Chicago') = 1, 'no automatic monthly bridges';\n  insert into public.streak_shields(owner_id, month_key, bridged_day) values\n    (roll, '2026-01-01', '2026-01-30'), (roll, '2026-02-01', '2026-02-02');\n  assert public.quest_streak_fire(roll, '2026-02-04', 'America/Chicago') = 4, 'confirmed monthly bridges';
  assert (select count(*) from public.streak_shields where owner_id = roll and month_key = '2026-01-01') = 1;
  assert (select count(*) from public.streak_shields where owner_id = roll and month_key = '2026-02-01') = 1;
  assert (select bridged_day from public.streak_shields where owner_id = roll and month_key = '2026-01-01') = '2026-01-30';
  assert (select bridged_day from public.streak_shields where owner_id = roll and month_key = '2026-02-01') = '2026-02-02';
  assert public.quest_streak_fire(roll, '2026-02-04', 'America/Chicago') = 4, 'second read does not stack';
end $$;

-- Approved Option A: the allowance flips at 05:00 Chicago on the 1st, and the spend is a sentence.
insert into auth.users(id) values ('00000000-0000-0000-0000-00000000c410');
do $$
declare
  u uuid := '00000000-0000-0000-0000-00000000c410';
  early jsonb; late jsonb; xp integer;
begin
  assert public.streak_shield_month('2026-03-01 04:59:00 America/Chicago') = '2026-02-01';
  assert public.streak_shield_month('2026-03-01 05:00:00 America/Chicago') = '2026-03-01';
  perform pg_temp.seed_day(u, '2026-02-26');
  perform pg_temp.seed_day(u, '2026-02-28');
  select coalesce(sum(amount), 0) into xp from public.xp_ledger where owner_id = u;
  early := public._streak_shield_status(u, '2026-03-01 04:59:00 America/Chicago');\n  assert early->>'status' = 'ready', 'status read cannot spend shield';\n  assert early->>'eligibleMissedDay' = '2026-02-27', 'status identifies eligible bridge';\n  assert not exists (select 1 from public.streak_shields where owner_id = u);\n  insert into public.streak_shields(owner_id, month_key, bridged_day) values (u, '2026-02-01', '2026-02-27');\n  early := public._streak_shield_status(u, '2026-03-01 04:59:00 America/Chicago');
  assert early->>'status' = 'used' and early->>'month' = '2026-02-01' and early->>'bridgedDay' = '2026-02-27', early::text;
  assert early->>'notice' = 'Streak Shield used · 0 remaining. Streak protected. You missed a day, but your journey continues. No XP was awarded.', early->>'notice';
  late := public._streak_shield_status(u, '2026-03-01 05:00:00 America/Chicago');
  assert late->>'status' = 'ready' and late->>'month' = '2026-03-01', late::text;\n  assert late->>'eligibleMissedDay' is null, 'old month cannot spend new month allowance';
  assert late->>'notice' = 'Streak Shield ready · 1 this month';
  assert (select count(*) from public.streak_shields where owner_id = u) = 1, 'March does not keep February''s shield';
  assert (select coalesce(sum(amount), 0) from public.xp_ledger where owner_id = u) = xp, 'the reset grants no XP';
end $$;

insert into public.companion_bonds(id, inviter_id, companion_id, status, token_hash, expires_at, accepted_at)
values (
  '00000000-0000-0000-0000-00000000c4b1',
  '00000000-0000-0000-0000-00000000c401',
  '00000000-0000-0000-0000-00000000c402',
  'active', 'couple-features-smoke', now() + interval '2 days', now());

-- Pack skips duplicate titles. Connor's award is the personal formula, never the pack's 20.
-- Izzy receives the config amount once, in her ledger only.
do $$
declare
  connor uuid := '00000000-0000-0000-0000-00000000c401';
  izzy uuid := '00000000-0000-0000-0000-00000000c402';
  today date := public.quest_game_day(pg_catalog.now(), 'America/Chicago');
  pack jsonb; q uuid; r jsonb; connor_xp integer; izzy_rows integer;
begin
  perform pg_temp.seed_day(connor, today - 1);
  perform pg_temp.seed_day(connor, today);
  perform set_config('request.jwt.claim.sub', connor::text, true);
  perform public.couple_quest_create('Game night', 'Already listed.', 'weekly');
  pack := public.couple_add_quest_pack();
  assert (pack->>'added')::int = 14 and (pack->>'skipped')::int = 1, pack::text;
  pack := public.couple_add_quest_pack();
  assert (pack->>'added')::int = 0 and (pack->>'skipped')::int = 15, pack::text;
  assert (select count(*) from public.couple_quests where bond_id = '00000000-0000-0000-0000-00000000c4b1') = 15;
  select id into q from public.couple_quests
    where bond_id = '00000000-0000-0000-0000-00000000c4b1' and title = 'Try something new';
  r := public.couple_quest_mark(q);
  assert (r->>'awarded')::boolean = false and (r->>'connorXp')::int = 0, r::text;
  perform set_config('request.jwt.claim.sub', izzy::text, true);
  r := public.couple_quest_mark(q);
  assert (r->>'awarded')::boolean and (r->>'izzyXp')::int = 10 and (r->>'connorXp')::int = 11, r::text;
  assert (r->>'firstOfDay')::boolean = false;
  select count(*) into connor_xp from public.xp_ledger where owner_id = connor and amount = 11;
  assert connor_xp = 1, 'Connor once, streak scaled, not 20';
  assert not exists (select 1 from public.xp_ledger where owner_id = connor and amount = 20);
  select count(*) into izzy_rows from public.companion_xp_ledger where owner_id = izzy and amount = 10;
  assert izzy_rows = 1;
  assert (select count(*) from public.xp_ledger where owner_id = izzy) = 0, 'Izzy XP stays out of the quest ledger';
  r := public.couple_quest_mark(q);
  assert (r->>'already')::boolean and (r->>'izzyXp')::int = 0 and (r->>'connorXp')::int = 0, r::text;
  perform set_config('request.jwt.claim.sub', connor::text, true);
  r := public.couple_quest_mark(q);
  assert (r->>'already')::boolean;
  assert (select count(*) from public.xp_ledger where owner_id = connor and amount = 11) = 1;
  assert (select count(*) from public.companion_xp_ledger where owner_id = izzy) = 1;

  update public.couple_xp_config set companion_xp = 0 where singleton;
  q := public.couple_quest_create('A quiet evening', 'One time.', 'once');
  perform public.couple_quest_mark(q);
  perform set_config('request.jwt.claim.sub', izzy::text, true);
  r := public.couple_quest_mark(q);
  assert (r->>'awarded')::boolean and (r->>'izzyXp')::int = 0, r::text;
  assert (select count(*) from public.companion_xp_ledger where owner_id = izzy) = 1, 'config 0 writes nothing for Izzy';
  update public.couple_xp_config set companion_xp = 10 where singleton;
end $$;

-- Date night: strict shape, steps do not award, the night awards once.
do $$
declare
  connor uuid := '00000000-0000-0000-0000-00000000c401';
  izzy uuid := '00000000-0000-0000-0000-00000000c402';
  night uuid; step uuid; r jsonb; ok boolean := false; before_c integer; before_i integer;
begin
  perform set_config('request.jwt.claim.sub', connor::text, true);
  begin
    perform public.couple_create_date_night('Only dinner', array['Dinner'], 5, 19, 0);
  exception when raise_exception then ok := sqlerrm = 'Invalid date night'; end;
  assert ok, 'one step rejected';
  ok := false;
  begin
    perform public.couple_create_date_night('Too many', array['A','B','C','D','E','F'], 5, 19, 0);
  exception when raise_exception then ok := sqlerrm = 'Invalid date night'; end;
  assert ok, 'six steps rejected';
  ok := false;
  begin
    perform public.couple_create_date_night('Bad hour', array['Dinner','Movie'], 5, 25, 0);
  exception when raise_exception then ok := sqlerrm = 'Invalid date night'; end;
  assert ok, 'hour rejected';
  night := public.couple_create_date_night('Dinner and a movie', array['Dinner','A movie'], 5, 19, 0);
  assert (select count(*) from public.couple_quest_steps where quest_id = night) = 2;
  assert (select due_at is not null from public.couple_quests where id = night);
  select id into step from public.couple_quest_steps where quest_id = night order by position limit 1;
  select count(*) into before_c from public.xp_ledger where owner_id = connor;
  select count(*) into before_i from public.companion_xp_ledger where owner_id = izzy;
  r := public.couple_step_done(step);
  assert (r->>'xp')::int = 0;
  assert (select count(*) from public.xp_ledger where owner_id = connor) = before_c;
  perform public.couple_quest_mark(night);
  perform set_config('request.jwt.claim.sub', izzy::text, true);
  r := public.couple_quest_mark(night);
  assert (r->>'awarded')::boolean and (r->>'izzyXp')::int = 10, r::text;
  r := public.couple_quest_mark(night);
  assert (r->>'already')::boolean and (r->>'connorXp')::int = 0;
  assert (select count(*) from public.companion_xp_ledger where owner_id = izzy) = before_i + 1;
end $$;

-- Sunday recap is bond-scoped. A fresh pair keeps the week numbers exact.
insert into auth.users(id) values
  ('00000000-0000-0000-0000-00000000c409'),
  ('00000000-0000-0000-0000-00000000c40a');
insert into public.companion_bonds(id, inviter_id, companion_id, status, token_hash, expires_at, accepted_at)
values (
  '00000000-0000-0000-0000-00000000c4b2',
  '00000000-0000-0000-0000-00000000c409',
  '00000000-0000-0000-0000-00000000c40a',
  'active', 'couple-features-recap', now() + interval '2 days', now());

do $$
declare
  connor uuid := '00000000-0000-0000-0000-00000000c401';
  izzy uuid := '00000000-0000-0000-0000-00000000c402';
  hero uuid := '00000000-0000-0000-0000-00000000c409';
  partner uuid := '00000000-0000-0000-0000-00000000c40a';
  stranger uuid := '00000000-0000-0000-0000-00000000c403';
  recap jsonb; ok boolean := false; izzy_xp integer; connor_xp integer;
begin
  perform pg_temp.seed_day(hero, '2026-11-09');
  perform pg_temp.seed_day(hero, '2026-11-10');
  perform pg_temp.seed_day(hero, '2026-11-11');
  insert into public.companion_xp_ledger(owner_id, bond_id, amount, source_key, reason, created_at)
  values
    (partner, '00000000-0000-0000-0000-00000000c4b2', 10, 'recap-a', 'couple_quest', '2026-11-10 18:00:00 America/Chicago'),
    (partner, '00000000-0000-0000-0000-00000000c4b2', 10, 'recap-b', 'couple_quest', '2026-11-11 18:00:00 America/Chicago');
  insert into public.companion_activities(bond_id, subject_id, recorded_by, request_id, title, dedupe_key, created_at)
  values
    ('00000000-0000-0000-0000-00000000c4b2', partner, hero, gen_random_uuid(), 'Walk', 'recap-walk-1', '2026-11-10 18:00:00 America/Chicago'),
    ('00000000-0000-0000-0000-00000000c4b2', partner, hero, gen_random_uuid(), 'Call', 'recap-walk-2', '2026-11-11 18:00:00 America/Chicago');
  perform set_config('request.jwt.claim.sub', hero::text, true);
  recap := public._couple_weekly_recap_at('2026-11-15 04:59:00 America/Chicago');
  assert (recap->>'visible')::boolean = false, 'before 05:00 Sunday is still Saturday';
  recap := public._couple_weekly_recap_at('2026-11-15 18:00:00 America/Chicago');
  assert (recap->>'visible')::boolean, recap::text;
  assert (recap->>'timeZone') = 'America/Chicago';
  assert (recap->>'weekStart') = '2026-11-08', recap::text;
  assert (recap->>'weekEnd') = '2026-11-15';
  assert (recap->'partners'->0->>'role') = 'adventurer';
  assert (recap->'partners'->0->>'done')::int = 3, recap::text;
  assert (recap->'partners'->0->>'xp')::int = 30, recap::text;
  assert (recap->'partners'->0->>'levelsGained')::int = 2, recap::text;
  assert (recap->'partners'->0->>'longestStreak')::int = 3, recap::text;
  assert (recap->'partners'->1->>'role') = 'companion';
  assert (recap->'partners'->1->>'xp')::int = 20, recap::text;
  assert (recap->'partners'->1->>'done')::int = 2, recap::text;
  assert (recap->'partners'->1->>'levelsGained')::int = 1, recap::text;
  assert (recap->'partners'->1->>'longestStreak')::int = 2, recap::text;
  -- Window edges: previous Sunday 05:00 counts, 04:59 does not; this Sunday 04:59 counts, 05:00 does not.
  perform pg_temp.seed_instant(hero, '2026-11-08 04:59:00 America/Chicago');
  perform pg_temp.seed_instant(hero, '2026-11-08 05:00:00 America/Chicago');
  perform pg_temp.seed_instant(hero, '2026-11-15 04:59:00 America/Chicago');
  perform pg_temp.seed_instant(hero, '2026-11-15 05:00:00 America/Chicago');
  recap := public._couple_weekly_recap_at('2026-11-15 05:00:00 America/Chicago');
  assert (recap->>'visible')::boolean and (recap->'partners'->0->>'done')::int = 5, recap::text;
  assert (recap->'partners'->0->>'xp')::int = 50, recap::text;
  -- Nov 8 04:59 is game day Nov 7: outside the XP window, still part of the streak that enters it.
  assert (recap->'partners'->0->>'longestStreak')::int = 5, recap::text;
  perform set_config('request.jwt.claim.sub', stranger::text, true);
  begin
    perform public._couple_weekly_recap_at('2026-11-15 18:00:00 America/Chicago');
  exception when raise_exception then ok := sqlerrm = 'Companion connection required'; end;
  assert ok, 'stranger recap';
  select coalesce(sum(amount), 0) into izzy_xp from public.companion_xp_ledger where owner_id = izzy;
  select coalesce(sum(amount), 0) into connor_xp from public.xp_ledger where owner_id = connor;
  update public.companion_bonds set status = 'revoked', revoked_at = now()
    where id = '00000000-0000-0000-0000-00000000c4b1';
  assert (select coalesce(sum(amount), 0) from public.companion_xp_ledger where owner_id = izzy) = izzy_xp;
  assert (select coalesce(sum(amount), 0) from public.xp_ledger where owner_id = connor) = connor_xp;
end $$;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000c401', false);
do $$ begin
  assert (select count(*) from public.couple_quests) = 0, 'revoked bond hides quests';
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000c402', false);
do $$ begin
  assert (select count(*) from public.companion_xp_ledger) >= 1, 'Izzy still owns her ledger rows';
  assert (select count(*) from public.couple_quests) = 0, 'revoked bond hides quests from Izzy too';
end $$;
reset role;
do $$ begin
  assert (select count(*) from public.couple_quests) = 17, 'rows remain after revoke';
end $$;

select 'couple features smoke passed' as result;
