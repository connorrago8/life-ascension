-- Quest & streak rules (202610310001). Run after every migration, in a disposable database only.
-- Values marked "TS parity" are produced by lib/questStreak.ts (tests/questStreaks.test.mjs).
\set ON_ERROR_STOP on

-- Pure helpers ---------------------------------------------------------------------------
do $$
begin
  assert public.quest_fnv1a('a') = 3826002220, 'fnv a';
  assert public.quest_fnv1a('héllo') = 1252296000, 'fnv utf8 (TS parity)';
  assert public.quest_fnv1a('00000000-0000-0000-0000-00000000d001:00000000-0000-0000-0000-00000000d0a1:2026-10-26') = 475018547, 'fnv TS parity';
  -- first of day: no bonus, whatever F is
  assert public.quest_streak_xp(1, 0, true) = 1;
  assert public.quest_streak_xp(1, 7, true) = 1;
  assert public.quest_streak_xp(10, 9, true) = 10;
  -- later completions: floor(xp * (1 + 0.1F))
  assert public.quest_streak_xp(10, 0, false) = 10;
  assert public.quest_streak_xp(10, 1, false) = 11, 'F=1 x1.1';
  assert public.quest_streak_xp(10, 7, false) = 17, 'F=7 x1.7';
  assert public.quest_streak_xp(3, 5, false) = 4, 'floor(4.5)';
  assert public.quest_streak_xp(1, 7, false) = 1, 'floor(1.7)';
  assert public.quest_streak_xp(1, 10, false) = 2;
  assert public.quest_streak_xp(1, 25, false) = 3, 'no cap';
  assert public.quest_streak_xp(1, 400, false) = 41, 'no cap';
  -- weeks start Monday; Sunday still belongs to the week
  assert public.quest_week_start('2026-10-26') = '2026-10-26';
  assert public.quest_week_start('2026-10-29') = '2026-10-26';
  assert public.quest_week_start('2026-11-01') = '2026-10-26', 'Sunday';
  assert public.quest_week_start('2026-11-02') = '2026-11-02', 'new week';
  -- weekly appearance: Wed 11:47 CDT for the TS parity seed
  assert public.quest_weekly_appears_at('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000d0a1', '2026-10-26', 'America/Chicago')
       = '2026-10-28 16:47:00+00'::timestamptz, 'appears_at TS parity';
  assert public.quest_timezone('00000000-0000-0000-0000-00000000dfff') = 'America/Chicago', 'tz fallback';
end $$;

-- Every appearance lands in Mon 00:00 .. Thu 12:00 local, including the DST-change week.
do $$
declare w date; t timestamptz; i integer;
begin
  foreach w in array array['2026-10-26'::date, '2026-11-02', '2027-03-08', '2027-03-15'] loop
    for i in 1 .. 300 loop
      t := public.quest_weekly_appears_at(gen_random_uuid(), gen_random_uuid(), w, 'America/Chicago');
      assert t >= (w::timestamp at time zone 'America/Chicago'), 'not before Monday 00:00';
      assert t < ((w::timestamp + interval '3 days 12 hours') at time zone 'America/Chicago'), 'before Thursday noon';
    end loop;
  end loop;
end $$;

-- Synthetic history (test administrator): one completion per listed local day.
create or replace function pg_temp.seed_day(p_owner uuid, p_day date, p_hour integer default 12) returns void language plpgsql as $$
declare q uuid := gen_random_uuid(); i uuid := gen_random_uuid();
begin
  insert into public.quests(id, owner_id, title, domain, cadence, scheduled_for, quest_type)
  values (q, p_owner, 'history ' || p_day, 'home', 'once', p_day, 'scheduled');
  insert into public.quest_instances(id, owner_id, quest_id, due_date, status, completed_at)
  values (i, p_owner, q, p_day, 'completed', ((p_day::timestamp + make_interval(hours => p_hour)) at time zone 'America/Chicago'));
  insert into public.xp_ledger(owner_id, instance_id, amount, awarded_at)
  values (p_owner, i, 1, ((p_day::timestamp + make_interval(hours => p_hour)) at time zone 'America/Chicago'));
end $$;

insert into auth.users(id) values
 ('00000000-0000-0000-0000-00000000e001'), ('00000000-0000-0000-0000-00000000e002'),
 ('00000000-0000-0000-0000-00000000e003'), ('00000000-0000-0000-0000-00000000e004'),
 ('00000000-0000-0000-0000-00000000e005'), ('00000000-0000-0000-0000-00000000e006');

-- Fire counting, midnight and DST boundaries (fixed dates) ---------------------------------
do $$
declare u uuid := '00000000-0000-0000-0000-00000000e001'; d integer;
begin
  for d in 1 .. 7 loop perform pg_temp.seed_day(u, date '2026-10-20' - d); end loop;
  assert public.quest_streak_fire(u, '2026-10-20', 'America/Chicago') = 7, 'F=7';
  -- today's own completions never count toward F
  perform pg_temp.seed_day(u, '2026-10-20');
  assert public.quest_streak_fire(u, '2026-10-20', 'America/Chicago') = 7, 'today ignored';
  assert public.quest_streak_fire(u, '2026-10-21', 'America/Chicago') = 8;
  -- one empty day resets: nothing on Oct 21, so Oct 22 has F=0 and Oct 23 too
  assert public.quest_streak_fire(u, '2026-10-22', 'America/Chicago') = 0, 'missed day resets';
  assert public.quest_streak_fire(u, '2026-10-23', 'America/Chicago') = 0;
  -- a gap inside the run stops the count
  assert public.quest_streak_fire(u, '2026-10-16', 'America/Chicago') = 3;
end $$;

do $$
declare u uuid := '00000000-0000-0000-0000-00000000e002'; q uuid := gen_random_uuid(); i uuid := gen_random_uuid();
begin
  -- 23:59:59 CDT on Oct 28 = 04:59:59Z Oct 29: belongs to Oct 28 locally, not Oct 29.
  insert into public.quests(id, owner_id, title, domain, cadence, scheduled_for, quest_type) values (q, u, 'edge', 'home', 'once', '2026-10-28', 'scheduled');
  insert into public.quest_instances(id, owner_id, quest_id, due_date, status, completed_at) values (i, u, q, '2026-10-28', 'completed', '2026-10-29 04:59:59+00');
  insert into public.xp_ledger(owner_id, instance_id, amount, awarded_at) values (u, i, 1, '2026-10-29 04:59:59+00');
  assert public.quest_has_completion_on(u, '2026-10-28', 'America/Chicago'), 'late night counts for that local day';
  assert not public.quest_has_completion_on(u, '2026-10-29', 'America/Chicago'), 'not the next UTC day';
  assert public.quest_streak_fire(u, '2026-10-29', 'America/Chicago') = 1;
  -- Fall back: Sun Nov 1 2026 is 25 hours long. 23:30 CST Nov 1 = 05:30Z Nov 2.
  q := gen_random_uuid(); i := gen_random_uuid();
  insert into public.quests(id, owner_id, title, domain, cadence, scheduled_for, quest_type) values (q, u, 'dst', 'home', 'once', '2026-11-01', 'scheduled');
  insert into public.quest_instances(id, owner_id, quest_id, due_date, status, completed_at) values (i, u, q, '2026-11-01', 'completed', '2026-11-02 05:30:00+00');
  insert into public.xp_ledger(owner_id, instance_id, amount, awarded_at) values (u, i, 1, '2026-11-02 05:30:00+00');
  assert public.quest_has_completion_on(u, '2026-11-01', 'America/Chicago'), 'DST day keeps its 25th hour';
  assert not public.quest_has_completion_on(u, '2026-11-02', 'America/Chicago');
  -- Spring forward: Sun Mar 14 2027 is 23 hours. 00:30 CDT Mar 15 = 05:30Z, belongs to Mar 15.
  perform pg_temp.seed_day(u, '2027-03-13', 23);
  q := gen_random_uuid(); i := gen_random_uuid();
  insert into public.quests(id, owner_id, title, domain, cadence, scheduled_for, quest_type) values (q, u, 'dst2', 'home', 'once', '2027-03-14', 'scheduled');
  insert into public.quest_instances(id, owner_id, quest_id, due_date, status, completed_at) values (i, u, q, '2027-03-14', 'completed', '2027-03-15 04:59:00+00');
  insert into public.xp_ledger(owner_id, instance_id, amount, awarded_at) values (u, i, 1, '2027-03-15 04:59:00+00');
  assert public.quest_has_completion_on(u, '2027-03-14', 'America/Chicago'), '23:59 CDT on the short day';
  assert public.quest_streak_fire(u, '2027-03-15', 'America/Chicago') = 2, 'streak across spring forward';
end $$;

-- Live awards through the real RPCs (relative to the real local today) ---------------------
-- e003: F=7 (only floor(1.7)=1 with 1 XP quests); e004: F=12 -> 2 XP; e005: missed yesterday -> F=0.
do $$
declare today date := (now() at time zone 'America/Chicago')::date; d integer;
begin
  for d in 1 .. 7 loop perform pg_temp.seed_day('00000000-0000-0000-0000-00000000e003', today - d); end loop;
  for d in 1 .. 12 loop perform pg_temp.seed_day('00000000-0000-0000-0000-00000000e004', today - d); end loop;
  for d in 2 .. 9 loop perform pg_temp.seed_day('00000000-0000-0000-0000-00000000e005', today - d); end loop;
end $$;

set role authenticated;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000e004', false);
do $$
declare today date := (now() at time zone 'America/Chicago')::date; q1 uuid; q2 uuid; q3 uuid; i uuid; r jsonb; s jsonb; t text;
begin
  s := public.get_quest_streak();
  assert (s->>'fire')::int = 12 and (s->>'done_today')::boolean = false and s->>'time_zone' = 'America/Chicago', s::text;
  q1 := public.create_scheduled_quest('Board daily', 'home', 'daily', today, 'scheduled');
  q2 := public.create_scheduled_quest('Off-board daily', 'home', 'daily', today, 'scheduled');
  q3 := public.create_scheduled_quest('Off-board via API path', 'home', 'daily', today, 'scheduled');
  -- first of the day: +1, no bonus, streak kept
  i := public.ensure_quest_instance(q1, today);
  r := public.set_quest_instance_status_v2(i, 'complete');
  assert r->>'reward_status' = 'awarded' and (r->>'xp_awarded')::int = 1 and (r->>'first_of_day')::boolean and (r->>'streak_fire')::int = 12, r::text;
  s := public.get_quest_streak();
  assert (s->>'fire')::int = 12 and (s->>'done_today')::boolean, 'F fixed all day';
  -- second (off the daily board): floor(1 * 2.2) = 2
  i := public.ensure_quest_instance(q2, today);
  r := public.set_quest_instance_status_v2(i, 'complete');
  assert r->>'reward_status' = 'awarded' and (r->>'xp_awarded')::int = 2 and not (r->>'first_of_day')::boolean and (r->>'base_xp')::int = 1, r::text;
  -- double tap / retry: never a second award
  r := public.set_quest_instance_status_v2(i, 'complete');
  assert r->>'reward_status' = 'already_awarded' and (r->>'xp_awarded')::int = 0, r::text;
  -- API/chat path (legacy text RPC) counts with the same bonus, once
  i := public.ensure_quest_instance(q3, today);
  t := public.set_quest_instance_status(i, 'complete');
  assert t = 'completed';
  t := public.set_quest_instance_status(i, 'complete');
  assert t = 'completed';
  r := public.set_quest_instance_status_v2(i, 'complete');
  assert r->>'reward_status' = 'already_awarded' and (r->>'xp_awarded')::int = 0 and (r->>'streak_fire')::int = 12, r::text;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000e003', false);
do $$
declare today date := (now() at time zone 'America/Chicago')::date; q uuid; i uuid; r jsonb;
begin
  q := public.create_scheduled_quest('F7 a', 'home', 'daily', today, 'scheduled');
  r := public.set_quest_instance_status_v2(public.ensure_quest_instance(q, today), 'complete');
  assert (r->>'xp_awarded')::int = 1 and (r->>'first_of_day')::boolean, r::text;
  q := public.create_scheduled_quest('F7 b', 'home', 'daily', today, 'scheduled');
  r := public.set_quest_instance_status_v2(public.ensure_quest_instance(q, today), 'complete');
  assert (r->>'xp_awarded')::int = 1 and (r->>'streak_fire')::int = 7 and not (r->>'first_of_day')::boolean, 'floor(1.7) = 1: ' || r::text;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000e005', false);
do $$
declare today date := (now() at time zone 'America/Chicago')::date; q uuid; r jsonb;
begin
  assert (public.get_quest_streak()->>'fire')::int = 0, 'a day with no completion resets';
  q := public.create_scheduled_quest('Reset a', 'home', 'daily', today, 'scheduled');
  r := public.set_quest_instance_status_v2(public.ensure_quest_instance(q, today), 'complete');
  assert (r->>'xp_awarded')::int = 1 and (r->>'first_of_day')::boolean;
  q := public.create_scheduled_quest('Reset b', 'home', 'daily', today, 'scheduled');
  r := public.set_quest_instance_status_v2(public.ensure_quest_instance(q, today), 'complete');
  assert (r->>'xp_awarded')::int = 1 and (r->>'streak_fire')::int = 0;
end $$;

-- Weekly quests ----------------------------------------------------------------------------
reset role;
do $$
declare
  u uuid := '00000000-0000-0000-0000-00000000e006';
  today date := (now() at time zone 'America/Chicago')::date;
  wk date := public.quest_week_start((now() at time zone 'America/Chicago')::date);
  nextwk date := public.quest_week_start((now() at time zone 'America/Chicago')::date + 1);
  q uuid; i uuid; i2 uuid; r jsonb; ok boolean; appears timestamptz;
begin
  perform set_config('request.jwt.claim.sub', u::text, true);
  set local role authenticated;
  q := public.create_scheduled_quest('Weekly laundry', 'home', 'weekly', today, 'scheduled');
  i := public.ensure_quest_instance(q, today);
  i2 := public.ensure_quest_instance(q, wk);
  assert i = i2, 'one instance per week, keyed by Monday';
  reset role;
  assert (select due_date from public.quest_instances where id = i) = wk, 'weekly instance due on Monday';
  appears := public.quest_weekly_appears_at(u, q, wk, 'America/Chicago');
  set local role authenticated;
  if now() >= appears then
    r := public.set_quest_instance_status_v2(i, 'complete');
    assert r->>'reward_status' = 'awarded' and (r->>'xp_awarded')::int = 1, r::text;
    r := public.set_quest_instance_status_v2(i, 'complete');
    assert r->>'reward_status' = 'already_awarded', 'weekly once per week';
  else
    ok := false;
    begin perform public.set_quest_instance_status_v2(i, 'complete');
    exception when raise_exception then ok := sqlerrm = 'This weekly quest is not on your board yet'; end;
    assert ok, 'weekly completed before it appeared';
  end if;
  -- next week's instance can't be completed early; the quest resets with the new week
  if nextwk <> wk then
    i2 := public.ensure_quest_instance(q, today + 1);
    assert i2 <> i, 'new week, new instance';
    ok := false;
    begin perform public.set_quest_instance_status_v2(i2, 'complete'); exception when raise_exception then ok := true; end;
    assert ok, 'next week blocked';
  end if;
end $$;

reset role;
-- Last week's weekly instance is closed once its Sunday ends.
do $$
declare
  u uuid := '00000000-0000-0000-0000-00000000e006';
  q uuid; i uuid := gen_random_uuid(); ok boolean := false;
  lastwk date := public.quest_week_start((now() at time zone 'America/Chicago')::date) - 7;
begin
  select id into q from public.quests where owner_id = u and cadence = 'weekly' limit 1;
  insert into public.quest_instances(id, owner_id, quest_id, due_date) values (i, u, q, lastwk);
  perform set_config('request.jwt.claim.sub', u::text, true);
  set local role authenticated;
  begin perform public.set_quest_instance_status_v2(i, 'complete');
  exception when raise_exception then ok := sqlerrm = 'Weekly quests can only be completed during their own week'; end;
  assert ok, 'past week closed';
end $$;
reset role;

-- Clients still can't mint XP or call the internal award.
do $$
declare ok boolean := false;
begin
  set local role authenticated;
  begin perform public._award_quest_xp('00000000-0000-0000-0000-00000000e006', gen_random_uuid());
  exception when insufficient_privilege then ok := true; end;
  assert ok, '_award_quest_xp must not be callable by clients';
end $$;
reset role;

select 'quest streak smoke passed' as result;
