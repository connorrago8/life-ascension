-- Pharmacy weekly autopilot. Disposable Postgres only, after every migration.
-- Work-task titles only. No patient information.
\set ON_ERROR_STOP on

-- Clock helpers. 04:59 is the previous game day; 05:00 opens the weekday, including DST.
do $$
declare
  u uuid := '00000000-0000-0000-0000-00000000f701';
  mon uuid; fall_sun uuid; spring_mon uuid; spring_sun uuid; june uuid; january uuid; plain uuid;
  appears timestamptz;
begin
  insert into auth.users(id) values (u);
  insert into public.profiles(id) values (u);
  insert into public.quests(owner_id, title, domain, cadence, scheduled_for, quest_type, fixed_reveal, weekly_weekday)
  values (u, 'Monday clock', 'career', 'weekly', '2026-11-02', 'scheduled', true, 1) returning id into mon;
  insert into public.quests(owner_id, title, domain, cadence, scheduled_for, quest_type, fixed_reveal, weekly_weekday)
  values (u, 'Fall Sunday', 'career', 'weekly', '2026-11-01', 'scheduled', true, 7) returning id into fall_sun;
  insert into public.quests(owner_id, title, domain, cadence, scheduled_for, quest_type, fixed_reveal, weekly_weekday)
  values (u, 'Spring Monday', 'career', 'weekly', '2026-03-09', 'scheduled', true, 1) returning id into spring_mon;
  insert into public.quests(owner_id, title, domain, cadence, scheduled_for, quest_type, fixed_reveal, weekly_weekday)
  values (u, 'Spring Sunday', 'career', 'weekly', '2026-03-08', 'scheduled', true, 7) returning id into spring_sun;
  insert into public.quests(owner_id, title, domain, cadence, scheduled_for, quest_type, fixed_reveal, weekly_weekday)
  values (u, 'June Monday', 'career', 'weekly', '2026-06-15', 'scheduled', true, 1) returning id into june;
  insert into public.quests(owner_id, title, domain, cadence, scheduled_for, quest_type, fixed_reveal, weekly_weekday)
  values (u, 'January Monday', 'career', 'weekly', '2026-01-12', 'scheduled', true, 1) returning id into january;
  insert into public.quests(owner_id, title, domain, cadence, scheduled_for, quest_type)
  values (u, 'Unflagged weekly', 'home', 'weekly', '2026-10-26', 'scheduled') returning id into plain;

  appears := public.quest_weekly_appears_at(u, mon, '2026-11-02', 'America/Chicago');
  assert appears = '2026-11-02 11:00:00+00'::timestamptz, 'Monday 05:00 CST';
  assert '2026-11-02 10:59:00+00'::timestamptz < appears, 'Monday 04:59 CST is before open';
  assert '2026-11-02 11:00:00+00'::timestamptz = appears, 'Monday 05:00 CST opens';

  appears := public.quest_weekly_appears_at(u, fall_sun, '2026-10-26', 'America/Chicago');
  assert appears = '2026-11-01 11:00:00+00'::timestamptz, 'fall-back Sunday 05:00 CST';
  assert '2026-11-01 10:59:00+00'::timestamptz < appears, 'fall-back Sunday 04:59 is still Saturday';

  appears := public.quest_weekly_appears_at(u, spring_mon, '2026-03-09', 'America/Chicago');
  assert appears = '2026-03-09 10:00:00+00'::timestamptz, 'spring-forward Monday 05:00 CDT';
  assert '2026-03-09 09:59:00+00'::timestamptz < appears, 'spring-forward Monday 04:59 CDT';

  appears := public.quest_weekly_appears_at(u, spring_sun, '2026-03-02', 'America/Chicago');
  assert appears = '2026-03-08 10:00:00+00'::timestamptz, 'spring-forward Sunday 05:00 CDT';
  assert '2026-03-08 09:59:00+00'::timestamptz < appears, 'spring-forward Sunday 04:59 CDT';

  assert public.quest_weekly_appears_at(u, june, '2026-06-15', 'America/Chicago') = '2026-06-15 10:00:00+00'::timestamptz, 'June Monday 05:00 CDT';
  assert public.quest_weekly_appears_at(u, january, '2026-01-12', 'America/Chicago') = '2026-01-12 11:00:00+00'::timestamptz, 'January Monday 05:00 CST';
  assert public.quest_weekly_appears_at(u, mon, '2026-11-02', 'America/New_York') = '2026-11-02 10:00:00+00'::timestamptz, 'Monday 05:00 EST';

  assert public.quest_weekly_appears_at('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000d0a1', '2026-10-26', 'America/Chicago')
    = '2026-10-29 07:47:00+00'::timestamptz, 'missing row keeps the seeded reveal';
  assert public.quest_weekly_appears_at(u, plain, '2026-10-26', 'America/Chicago')
    >= (('2026-10-26'::timestamp + interval '5 hours') at time zone 'America/Chicago');
  assert public.quest_weekly_appears_at(u, plain, '2026-10-26', 'America/Chicago')
    < (('2026-10-26'::timestamp + interval '3 days 12 hours') at time zone 'America/Chicago');
  assert public.quest_weekly_appears_at(u, plain, '2026-10-26', 'America/Chicago')
    <> public.quest_weekly_appears_at(u, mon, '2026-10-26', 'America/Chicago'), 'unflagged reveal is not Monday 05:00 by force';
  assert public.quest_timezone(u) = 'America/Chicago', 'profile without a zone falls back to Chicago';
  assert position('quest_streak_xp(10' in pg_catalog.pg_get_functiondef('public._award_personal_quest_xp(uuid,uuid)'::regprocedure)) > 0;
  assert position('_award_personal_quest_xp' in pg_catalog.pg_get_functiondef('public._award_quest_xp(uuid,uuid)'::regprocedure)) > 0;
  assert position('v_amount := 2' in pg_catalog.pg_get_functiondef('public._award_quest_xp(uuid,uuid)'::regprocedure)) = 0, 'no companion bonus';
end $$;

create or replace procedure pg_temp.freeze_clock(p_at timestamptz) language plpgsql as $$
declare sig text; def text; clock text;
begin
  clock := 'timestamptz ''' || to_char(p_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS') || '+00''';
  foreach sig in array array[
    'public.create_scheduled_quest(text,text,text,date,text)',
    'public.ensure_quest_instance(uuid,date)',
    'public.set_quest_instance_status(uuid,text)',
    'public.set_quest_instance_status_v2(uuid,text)',
    'public._award_personal_quest_xp(uuid,uuid)',
    'public._award_quest_xp(uuid,uuid)',
    'public.get_quest_streak()',
    'public._check_weekly_window(uuid,uuid,date)',
    'public.log_quest_progress(uuid,uuid,integer)',
    'public.reschedule_quest(uuid,date)',
    'public.quest_today()',
    'public._insert_weekly_autopilot_quest(uuid,text,text,integer)',
    'public.create_weekly_autopilot_quest(text,text,integer)',
    'public._apply_pharmacy_weekly_pack(uuid)',
    'public.apply_pharmacy_weekly_pack()',
    'public.apply_pharmacy_weekly_pack_for_user(uuid)',
    'public._place_companion_quest(uuid)'
  ] loop
    def := pg_catalog.pg_get_functiondef(sig::regprocedure);
    def := replace(def, 'pg_catalog.now()', clock);
    def := replace(def, 'now()', clock);
    execute def;
  end loop;
end $$;

-- Monday 04:59 Chicago is still the previous week. The new Monday row does not open.
begin;
call pg_temp.freeze_clock('2026-11-02 10:59:00+00');
insert into auth.users(id) values ('00000000-0000-0000-0000-00000000f702');
insert into public.profiles(id) values ('00000000-0000-0000-0000-00000000f702');
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000f702', true);
do $$
declare
  u uuid := '00000000-0000-0000-0000-00000000f702';
  q uuid; old_id uuid; new_id uuid; r jsonb; rows integer;
begin
  assert (public.get_quest_streak()->>'today') = '2026-11-01', 'Monday 04:59 is still Sunday';
  q := public.create_weekly_autopilot_quest('Bench count', 'career', 1);
  assert (select weekly_weekday from public.quests where id = q) = 1;
  assert (select fixed_reveal from public.quests where id = q) is true;
  new_id := public.ensure_quest_instance(q, '2026-11-02');
  assert new_id is null, 'Monday 04:59 does not open this week';
  assert (select count(*) from public.quest_instances where quest_id = q and due_date = '2026-11-02') = 0;
  old_id := public.ensure_quest_instance(q, '2026-11-01');
  assert old_id is not null;
  assert (select due_date from public.quest_instances where id = old_id) = '2026-10-26', '04:59 still belongs to the previous Monday';
  r := public.set_quest_instance_status_v2(old_id, 'complete');
  assert r->>'reward_status' = 'awarded' and (r->>'xp_awarded')::int = 10 and (r->>'base_xp')::int = 10, r::text;
  select count(*) into rows from public.xp_ledger where instance_id = old_id;
  assert rows = 1, 'previous week awards once';
end $$;
rollback;

-- Monday 05:00 opens one instance. A second ensure and a second insert do not duplicate it.
-- XP is the personal base-10 streak, not a flat 1.
begin;
call pg_temp.freeze_clock('2026-11-02 11:00:00+00');
insert into auth.users(id) values ('00000000-0000-0000-0000-00000000f703');
insert into public.profiles(id) values ('00000000-0000-0000-0000-00000000f703');
insert into public.quests(id, owner_id, title, domain, cadence, scheduled_for, quest_type)
values ('00000000-0000-0000-0000-00000000f7c1', '00000000-0000-0000-0000-00000000f703', 'yesterday', 'home', 'once', '2026-11-01', 'scheduled');
insert into public.quest_instances(id, owner_id, quest_id, due_date, status, completed_at)
values ('00000000-0000-0000-0000-00000000f7c2', '00000000-0000-0000-0000-00000000f703', '00000000-0000-0000-0000-00000000f7c1', '2026-11-01', 'completed', '2026-11-01 18:00:00+00');
insert into public.xp_ledger(owner_id, instance_id, amount, awarded_at)
values ('00000000-0000-0000-0000-00000000f703', '00000000-0000-0000-0000-00000000f7c2', 10, '2026-11-01 18:00:00+00');
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000f703', true);
do $$
declare
  u uuid := '00000000-0000-0000-0000-00000000f703';
  q uuid; q2 uuid; i uuid; i2 uuid; old_id uuid; r jsonb; ok boolean := false; rows integer; total integer;
begin
  assert (public.get_quest_streak()->>'today') = '2026-11-02', 'Monday 05:00';
  q := public.create_weekly_autopilot_quest('Opening count', 'career', 1);
  i := public.ensure_quest_instance(q, '2026-11-02');
  i2 := public.ensure_quest_instance(q, '2026-11-02');
  assert i = i2 and i is not null, 'ensure twice returns one instance';
  assert (select due_date from public.quest_instances where id = i) = '2026-11-02';
  assert (select count(*) from public.quest_instances where quest_id = q and due_date = '2026-11-02') = 1, 'one row per quest per week';
  reset role;
  begin
    insert into public.quest_instances(owner_id, quest_id, due_date) values (u, q, '2026-11-02');
  exception when unique_violation then
    ok := true;
  end;
  assert ok, 'unique (quest_id, due_date) blocks a second row';
  set local role authenticated;
  r := public.set_quest_instance_status_v2(i, 'complete');
  assert r->>'reward_status' = 'awarded' and (r->>'xp_awarded')::int = 10 and (r->>'base_xp')::int = 10
    and (r->>'first_of_day')::boolean and (r->>'streak_fire')::int = 1, r::text;
  r := public.set_quest_instance_status_v2(i, 'complete');
  assert r->>'reward_status' = 'already_awarded' and (r->>'xp_awarded')::int = 0, 'second complete awards 0';
  select count(*), coalesce(sum(amount), 0) into rows, total from public.xp_ledger where instance_id = i;
  assert rows = 1 and total = 10, 'ledger is base 10 once';
  -- The ledger default clock is the real instant. Stamp the frozen Monday so the
  -- next completion can see this one inside that game day.
  reset role;
  update public.xp_ledger set awarded_at = '2026-11-02 11:00:00+00' where instance_id = i;
  set local role authenticated;
  q2 := public.create_weekly_autopilot_quest('Second count', 'career', 1);
  i2 := public.ensure_quest_instance(q2, '2026-11-02');
  r := public.set_quest_instance_status_v2(i2, 'complete');
  assert (r->>'xp_awarded')::int = 11 and (r->>'base_xp')::int = 10 and (r->>'first_of_day')::boolean = false, r::text;
  reset role;
  insert into public.quest_instances(owner_id, quest_id, due_date)
  values (u, q, '2026-10-26') returning id into old_id;
  set local role authenticated;
  ok := false;
  begin
    perform public.set_quest_instance_status_v2(old_id, 'complete');
  exception when raise_exception then
    ok := sqlerrm = 'Weekly quests can only be completed during their own week';
  end;
  assert ok, 'previous week closes at Monday 05:00';
  assert (select count(*) from public.xp_ledger where instance_id = old_id) = 0, 'closed week writes no ledger row';
end $$;
rollback;

-- Pack skips titles that already exist and does not add them again.
begin;
call pg_temp.freeze_clock('2026-11-05 18:00:00+00');
insert into auth.users(id) values
  ('00000000-0000-0000-0000-00000000f704'),
  ('00000000-0000-0000-0000-00000000f705');
insert into public.profiles(id) values
  ('00000000-0000-0000-0000-00000000f704'),
  ('00000000-0000-0000-0000-00000000f705');
insert into public.quests(id, owner_id, title, domain, cadence, scheduled_for, quest_type, active)
values
  ('00000000-0000-0000-0000-00000000f7d1', '00000000-0000-0000-0000-00000000f704', '  Supplies   ORDER', 'home', 'once', '2026-11-05', 'scheduled', true),
  ('00000000-0000-0000-0000-00000000f7d2', '00000000-0000-0000-0000-00000000f704', 'Attendance check', 'career', 'once', '2026-11-01', 'scheduled', false);
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000f704', true);
do $$
declare
  u uuid := '00000000-0000-0000-0000-00000000f704';
  other uuid := '00000000-0000-0000-0000-00000000f705';
  added integer; q uuid; i uuid; i2 uuid; n integer; denied boolean := false;
  tech_id uuid; tech_title text; tech_domain text; tech_cadence text; tech_for date;
  tech_active boolean; tech_fixed boolean; tech_dow smallint; tech_xp integer;
begin
  added := public.apply_pharmacy_weekly_pack();
  assert added = 4, 'skips the two titles that already exist';
  added := public.apply_pharmacy_weekly_pack();
  assert added = 0, 'second pack adds nothing';
  assert (select cadence from public.quests where id = '00000000-0000-0000-0000-00000000f7d1') = 'once', 'existing quest is preserved';
  assert (select active from public.quests where id = '00000000-0000-0000-0000-00000000f7d2') = false, 'archived row is preserved';
  for q in select id from public.quests where owner_id = u and fixed_reveal is true loop
    i := public.ensure_quest_instance(q, '2026-11-05');
    i2 := public.ensure_quest_instance(q, '2026-11-05');
    assert i = i2 and i is not null;
    assert (select due_date from public.quest_instances where id = i) = '2026-11-02';
    assert (select count(*) from public.quest_instances where quest_id = q and due_date = '2026-11-02') = 1, 'refresh does not duplicate';
  end loop;
  reset role;
  select count(*) into n from public.quests
   where owner_id = u and public.quest_title_key(title) in (
     'tech schedule','pharmacist schedule','supplies order','u learn check','attendance check','pto check');
  assert n = 6, 'six titles, no duplicate rows';
  select count(*) into n from public.quests
   where owner_id = u and active and fixed_reveal is true and weekly_weekday = 1 and cadence = 'weekly' and domain = 'career';
  assert n = 4, 'only the missing titles were added';
  select id, title, domain, cadence, scheduled_for, active, fixed_reveal, weekly_weekday, xp
    into tech_id, tech_title, tech_domain, tech_cadence, tech_for, tech_active, tech_fixed, tech_dow, tech_xp
    from public.quests where owner_id = u and title = 'Tech schedule';
  assert (select description from public.quests where id = tech_id) = 'Set the crew''s week in motion with a clear, fair plan.';
  assert (select description from public.quests where owner_id = u and title = 'Pharmacist schedule') = 'Keep the watch covered and every shift accounted for.';
  assert (select description from public.quests where owner_id = u and title = 'U Learn check') = 'Clear the training ledger and keep your skills sharp.';
  assert (select description from public.quests where owner_id = u and title = 'PTO check') = 'Mark upcoming absences so the team can plan ahead.';
  assert (select description from public.quests where id = '00000000-0000-0000-0000-00000000f7d1') is null, 'a different Supplies order keeps its blank description';
  assert (select description from public.quests where id = '00000000-0000-0000-0000-00000000f7d2') is null, 'an archived different quest is not rewritten';
  assert public._sync_pharmacy_weekly_descriptions(u) = 0, 'descriptions already match';
  update public.quests set description = 'temporary' where id = tech_id;
  assert public._sync_pharmacy_weekly_descriptions(u) = 1, 'a blank or stale sentence is filled again';
  assert (select description from public.quests where id = tech_id) = 'Set the crew''s week in motion with a clear, fair plan.';
  assert (select title from public.quests where id = tech_id) = tech_title;
  assert (select domain from public.quests where id = tech_id) = tech_domain;
  assert (select cadence from public.quests where id = tech_id) = tech_cadence;
  assert (select scheduled_for from public.quests where id = tech_id) = tech_for;
  assert (select active from public.quests where id = tech_id) = tech_active;
  assert (select fixed_reveal from public.quests where id = tech_id) = tech_fixed;
  assert (select weekly_weekday from public.quests where id = tech_id) = tech_dow;
  assert (select xp from public.quests where id = tech_id) = tech_xp;
  assert (select id from public.quests where id = tech_id) = tech_id;
  assert public._sync_pharmacy_weekly_descriptions(u) = 0, 'second sync changes nothing';
  assert public.apply_pharmacy_weekly_pack_for_user(u) = 0, 'service helper is idempotent';
  assert public.apply_pharmacy_weekly_pack_for_user(other) = 6, 'another account gets its own six';
  assert public.apply_pharmacy_weekly_pack_for_user(other) = 0;
  set local role authenticated;
  begin
    perform public.apply_pharmacy_weekly_pack_for_user(u);
  exception when insufficient_privilege then
    denied := true;
  end;
  assert denied, 'a signed-in player cannot target another account';
end $$;
rollback;

-- A companion request titled PTO check does not attach to the work quest.
-- An ordinary title still reuses the player's matching quest.
begin;
call pg_temp.freeze_clock('2026-11-05 18:00:00+00');
insert into auth.users(id) values
  ('00000000-0000-0000-0000-00000000f706'),
  ('00000000-0000-0000-0000-00000000f707');
insert into public.profiles(id) values
  ('00000000-0000-0000-0000-00000000f706'),
  ('00000000-0000-0000-0000-00000000f707');
insert into public.companion_bonds(id, inviter_id, companion_id, status, token_hash, expires_at, accepted_at)
values ('00000000-0000-0000-0000-00000000f7b1', '00000000-0000-0000-0000-00000000f706', '00000000-0000-0000-0000-00000000f707',
        'active', 'pharmacy-weekly-token-f706', '2026-11-20 00:00:00+00', '2026-11-05 18:00:00+00');
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000f706', true);
do $$
declare
  u uuid := '00000000-0000-0000-0000-00000000f706';
  work uuid; towels uuid; placed jsonb; copied uuid;
begin
  work := public.create_weekly_autopilot_quest('PTO check', 'career', 1);
  perform public.ensure_quest_instance(work, '2026-11-05');
  towels := public.create_scheduled_quest('Fold towels', 'home', 'daily', '2026-11-05', 'scheduled');
  perform public.ensure_quest_instance(towels, '2026-11-05');
  reset role;
  insert into public.companion_quests(id, bond_id, from_user, to_user, title, due_on, status, cadence)
  values ('00000000-0000-0000-0000-00000000f7b2', '00000000-0000-0000-0000-00000000f7b1',
          '00000000-0000-0000-0000-00000000f707', u, 'PTO check', '2026-11-05', 'sent', 'weekly');
  placed := public._place_companion_quest('00000000-0000-0000-0000-00000000f7b2');
  select quest_id into copied from public.companion_quests where id = '00000000-0000-0000-0000-00000000f7b2';
  assert copied is distinct from work, 'companion does not attach to the weekly work quest';
  assert (select domain from public.quests where id = copied) = 'relationships';
  assert (select id from public.quests where id = work) = work, 'work quest is preserved';
  insert into public.companion_quests(id, bond_id, from_user, to_user, title, due_on, status, cadence)
  values ('00000000-0000-0000-0000-00000000f7b3', '00000000-0000-0000-0000-00000000f7b1',
          '00000000-0000-0000-0000-00000000f707', u, 'Fold towels', '2026-11-05', 'sent', 'daily');
  perform public._place_companion_quest('00000000-0000-0000-0000-00000000f7b3');
  assert (select quest_id from public.companion_quests where id = '00000000-0000-0000-0000-00000000f7b3') = towels,
    'ordinary title still dedupes';
end $$;
rollback;

-- 10:30Z is 05:30 in New York and 04:30 in Chicago. Only New York's Monday is open.
begin;
alter table public.profiles add column if not exists timezone text;
call pg_temp.freeze_clock('2026-11-02 10:30:00+00');
insert into auth.users(id) values
  ('00000000-0000-0000-0000-00000000f708'),
  ('00000000-0000-0000-0000-00000000f709');
insert into public.profiles(id, timezone) values
  ('00000000-0000-0000-0000-00000000f708', 'America/Chicago'),
  ('00000000-0000-0000-0000-00000000f709', 'America/New_York');
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000f708', true);
do $$
declare q uuid; opened uuid;
begin
  assert (public.get_quest_streak()->>'today') = '2026-11-01';
  assert (public.get_quest_streak()->>'time_zone') = 'America/Chicago';
  q := public.create_weekly_autopilot_quest('Chicago Monday', 'career', 1);
  opened := public.ensure_quest_instance(q, '2026-11-02');
  assert opened is null, 'Chicago 04:30 does not open Monday';
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000f709', true);
do $$
declare q uuid; opened uuid;
begin
  assert (public.get_quest_streak()->>'today') = '2026-11-02';
  assert (public.get_quest_streak()->>'time_zone') = 'America/New_York';
  q := public.create_weekly_autopilot_quest('New York Monday', 'career', 1);
  opened := public.ensure_quest_instance(q, '2026-11-02');
  assert opened is not null, 'New York 05:30 opens Monday';
  assert (select count(*) from public.quest_instances where quest_id = q) = 1;
  opened := public.ensure_quest_instance(q, '2026-11-02');
  assert (select count(*) from public.quest_instances where quest_id = q) = 1, 'second ensure does not duplicate';
end $$;
rollback;

do $$
begin
  assert has_function_privilege('authenticated', 'public.apply_pharmacy_weekly_pack()', 'execute');
  assert not has_function_privilege('anon', 'public.apply_pharmacy_weekly_pack()', 'execute');
  assert not has_function_privilege('authenticated', 'public.apply_pharmacy_weekly_pack_for_user(uuid)', 'execute');
  assert has_function_privilege('service_role', 'public.apply_pharmacy_weekly_pack_for_user(uuid)', 'execute');
end $$;

select 'pharmacy weekly smoke passed';
