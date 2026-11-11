-- Game day starts at 05:00 local. Disposable database only, after every migration.
\set ON_ERROR_STOP on

-- Pure clock: 04:59 belongs to the previous game day; 05:00 starts the new one.
do $$
begin
  assert public.quest_game_day('2026-06-15 09:59:00+00', 'America/Chicago') = '2026-06-14', '04:59 CDT';
  assert public.quest_game_day('2026-06-15 10:00:00+00', 'America/Chicago') = '2026-06-15', '05:00 CDT';
  assert public.quest_game_day('2026-01-15 10:59:00+00', 'America/Chicago') = '2026-01-14', '04:59 CST';
  assert public.quest_game_day('2026-01-15 11:00:00+00', 'America/Chicago') = '2026-01-15', '05:00 CST';
  -- Spring forward 2026-03-08: 05:00 CDT still exists after the 02:00 jump.
  assert public.quest_game_day('2026-03-08 09:59:00+00', 'America/Chicago') = '2026-03-07', '04:59 CDT on spring-forward morning';
  assert public.quest_game_day('2026-03-08 10:00:00+00', 'America/Chicago') = '2026-03-08', '05:00 CDT on spring-forward morning';
  -- Fall back 2026-11-01: both 01:30 passes are before 05:00 CST.
  assert public.quest_game_day('2026-11-01 06:30:00+00', 'America/Chicago') = '2026-10-31', '01:30 CDT first pass';
  assert public.quest_game_day('2026-11-01 07:30:00+00', 'America/Chicago') = '2026-10-31', '01:30 CST second pass';
  assert public.quest_game_day('2026-11-01 10:59:00+00', 'America/Chicago') = '2026-10-31', '04:59 CST';
  assert public.quest_game_day('2026-11-01 11:00:00+00', 'America/Chicago') = '2026-11-01', '05:00 CST';
  -- Week flips at Monday 05:00, not at midnight.
  assert public.quest_game_day('2026-11-02 10:59:00+00', 'America/Chicago') = '2026-11-01', 'Monday 04:59 is still Sunday';
  assert public.quest_week_start(public.quest_game_day('2026-11-02 10:59:00+00', 'America/Chicago')) = '2026-10-26';
  assert public.quest_game_day('2026-11-02 11:00:00+00', 'America/Chicago') = '2026-11-02', 'Monday 05:00';
  assert public.quest_week_start(public.quest_game_day('2026-11-02 11:00:00+00', 'America/Chicago')) = '2026-11-02';
  -- Profile zone is an argument. 10:30Z is 04:30 CST and 05:30 EST.
  assert public.quest_game_day('2026-11-06 10:30:00+00', 'America/Chicago') = '2026-11-05';
  assert public.quest_game_day('2026-11-06 10:30:00+00', 'America/New_York') = '2026-11-06';
end $$;

-- Ledger windows follow the same 05:00 cut, including both DST mornings.
insert into auth.users(id) values ('00000000-0000-0000-0000-00000000e301');

create or replace function pg_temp.stamp(p_owner uuid, p_at timestamptz) returns void language plpgsql as $$
declare q uuid := gen_random_uuid(); i uuid := gen_random_uuid();
begin
  insert into public.quests(id, owner_id, title, domain, cadence, scheduled_for, quest_type)
  values (q, p_owner, 'stamp', 'home', 'once', '2026-01-01', 'scheduled');
  insert into public.quest_instances(id, owner_id, quest_id, due_date, status, completed_at)
  values (i, p_owner, q, '2026-01-01', 'completed', p_at);
  insert into public.xp_ledger(owner_id, instance_id, amount, awarded_at)
  values (p_owner, i, 1, p_at);
end $$;

do $$
declare u uuid := '00000000-0000-0000-0000-00000000e301';
begin
  perform pg_temp.stamp(u, '2026-06-15 09:59:00+00');
  assert public.quest_has_completion_on(u, '2026-06-14', 'America/Chicago'), '04:59 counts yesterday';
  assert not public.quest_has_completion_on(u, '2026-06-15', 'America/Chicago'), '04:59 is not yet today';
  perform pg_temp.stamp(u, '2026-06-15 10:00:00+00');
  assert public.quest_has_completion_on(u, '2026-06-15', 'America/Chicago'), '05:00 starts the game day';
  -- Streak: 04:59 on Nov 6 is game day Nov 5, so Nov 6's fire includes it and Nov 6's own 05:00 does not raise F.
  perform pg_temp.stamp(u, '2026-11-06 10:59:00+00');
  assert public.quest_has_completion_on(u, '2026-11-05', 'America/Chicago');
  assert not public.quest_has_completion_on(u, '2026-11-06', 'America/Chicago');
  assert public.quest_streak_fire(u, '2026-11-06', 'America/Chicago') = 1, 'fire fixed from the 04:59 completion';
  assert public.quest_streak_fire(u, '2026-11-05', 'America/Chicago') = 0;
  perform pg_temp.stamp(u, '2026-11-06 11:00:00+00');
  assert public.quest_has_completion_on(u, '2026-11-06', 'America/Chicago');
  assert public.quest_streak_fire(u, '2026-11-06', 'America/Chicago') = 1, 'today still does not increase F';
  assert public.quest_streak_fire(u, '2026-11-07', 'America/Chicago') = 2, 'streak crosses 05:00';
  -- DST mornings.
  perform pg_temp.stamp(u, '2026-03-08 09:59:00+00');
  perform pg_temp.stamp(u, '2026-03-08 10:00:00+00');
  assert public.quest_has_completion_on(u, '2026-03-07', 'America/Chicago'), 'spring-forward 04:59';
  assert public.quest_has_completion_on(u, '2026-03-08', 'America/Chicago'), 'spring-forward 05:00';
  perform pg_temp.stamp(u, '2026-11-01 06:30:00+00');
  perform pg_temp.stamp(u, '2026-11-01 07:30:00+00');
  perform pg_temp.stamp(u, '2026-11-01 10:59:00+00');
  perform pg_temp.stamp(u, '2026-11-01 11:00:00+00');
  assert public.quest_has_completion_on(u, '2026-10-31', 'America/Chicago'), 'fall-back hours before 05:00';
  assert public.quest_has_completion_on(u, '2026-11-01', 'America/Chicago'), 'fall-back 05:00';
  assert not public.quest_has_completion_on(u, '2026-11-02', 'America/Chicago');
end $$;

-- Duplicate completion awards XP once. Second call is already_awarded and adds no row.
insert into auth.users(id) values ('00000000-0000-0000-0000-00000000e302');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000e302', false);
do $$
declare today date := (public.get_quest_streak()->>'today')::date;
  q uuid; i uuid; r jsonb; rows integer; total integer;
begin
  q := public.create_scheduled_quest('Once only', 'home', 'daily', today, 'scheduled');
  i := public.ensure_quest_instance(q, today);
  r := public.set_quest_instance_status_v2(i, 'complete');
  assert r->>'reward_status' = 'awarded' and (r->>'xp_awarded')::int = 10 and (r->>'first_of_day')::boolean, r::text;
  r := public.set_quest_instance_status_v2(i, 'complete');
  assert r->>'reward_status' = 'already_awarded' and (r->>'xp_awarded')::int = 0, r::text;
  select count(*), coalesce(sum(amount), 0) into rows, total from public.xp_ledger where instance_id = i;
  assert rows = 1 and total = 10, 'duplicate completion minted XP';
end $$;
reset role;

-- Session-scoped clock swap. Each test transaction rolls the function bodies back.
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
    'public.reschedule_quest(uuid,date)'
  ] loop
    def := pg_catalog.pg_get_functiondef(sig::regprocedure);
    def := replace(def, 'pg_catalog.now()', clock);
    def := replace(def, 'now()', clock);
    execute def;
  end loop;
end $$;

-- Frozen clock: 2026-11-06 00:30 America/Chicago must not credit game day Nov 6.
begin;
call pg_temp.freeze_clock('2026-11-06 06:30:00+00');
insert into auth.users(id) values ('00000000-0000-0000-0000-00000000e303');
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000e303', true);
do $$
declare day date := '2026-11-05';
  q uuid; previous_id uuid; future_id uuid; r jsonb; rejected boolean := false; total integer; rows integer;
begin
  assert day = '2026-11-05', day::text;
  assert (public.get_quest_streak()->>'today') = '2026-11-05';
  q := public.create_scheduled_quest('Boundary daily', 'home', 'daily', '2026-11-01', 'scheduled');
  previous_id := public.ensure_quest_instance(q, day);
  r := public.set_quest_instance_status_v2(previous_id, 'complete');
  assert (r->>'xp_awarded')::int = 10, r::text;
  r := public.set_quest_instance_status_v2(previous_id, 'complete');
  assert (r->>'xp_awarded')::int = 0 and r->>'reward_status' = 'already_awarded', r::text;
  select count(*), coalesce(sum(amount), 0) into rows, total from public.xp_ledger where instance_id = previous_id;
  assert rows = 1 and total = 10, '00:30 completion of the open game day awards once';
  future_id := public.ensure_quest_instance(q, day + 1);
  begin
    perform public.set_quest_instance_status_v2(future_id, 'complete');
  exception when raise_exception then
    rejected := sqlerrm = 'Future daily quests cannot be completed';
  end;
  select coalesce(sum(amount), 0) into total from public.xp_ledger where instance_id = future_id;
  assert rejected and total = 0, 'Nov 6 cannot be credited at 00:30 Chicago';
end $$;
rollback;

-- Monday 04:59 is still the previous week; Monday 05:00 opens the new week and closes the old one.
begin;
call pg_temp.freeze_clock('2026-11-02 10:59:00+00');
insert into auth.users(id) values ('00000000-0000-0000-0000-00000000e304');
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000e304', true);
do $$
declare q uuid; i uuid; nxt uuid; r jsonb; rejected boolean := false;
begin
  assert (public.get_quest_streak()->>'today') = '2026-11-01';
  q := public.create_scheduled_quest('Weekly boundary', 'home', 'weekly', '2026-11-01', 'scheduled');
  i := public.ensure_quest_instance(q, '2026-11-01');
  assert (select due_date from public.quest_instances where id = i) = '2026-10-26', 'still the previous Monday';
  r := public.set_quest_instance_status_v2(i, 'complete');
  assert r->>'reward_status' = 'awarded' and (r->>'xp_awarded')::int = 10, r::text;
  nxt := public.ensure_quest_instance(q, '2026-11-02');
  begin
    perform public.set_quest_instance_status_v2(nxt, 'complete');
  exception when raise_exception then
    rejected := sqlerrm = 'Weekly quests can only be completed during their own week';
  end;
  assert rejected, 'next week is not open at Monday 04:59';
end $$;
rollback;

begin;
call pg_temp.freeze_clock('2026-11-02 11:00:00+00');
insert into auth.users(id) values ('00000000-0000-0000-0000-00000000e305');
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000e305', true);
do $$
declare q uuid; old_id uuid; new_id uuid; rejected boolean := false; early boolean := false; appears timestamptz;
begin
  assert (public.get_quest_streak()->>'today') = '2026-11-02';
  q := public.create_scheduled_quest('Weekly opens', 'home', 'weekly', '2026-10-26', 'scheduled');
  old_id := public.ensure_quest_instance(q, '2026-11-01');
  begin
    perform public.set_quest_instance_status_v2(old_id, 'complete');
  exception when raise_exception then
    rejected := sqlerrm = 'Weekly quests can only be completed during their own week';
  end;
  assert rejected, 'previous week closes at Monday 05:00';
  new_id := public.ensure_quest_instance(q, '2026-11-02');
  assert (select due_date from public.quest_instances where id = new_id) = '2026-11-02';
  reset role;
  appears := public.quest_weekly_appears_at('00000000-0000-0000-0000-00000000e305', q, '2026-11-02', 'America/Chicago');
  set local role authenticated;
  assert appears >= ('2026-11-02 05:00:00'::timestamp at time zone 'America/Chicago');
  assert appears < ('2026-11-05 12:00:00'::timestamp at time zone 'America/Chicago');
  if '2026-11-02 11:00:00+00'::timestamptz < appears then
    begin
      perform public.set_quest_instance_status_v2(new_id, 'complete');
    exception when raise_exception then
      early := sqlerrm = 'This weekly quest is not on your board yet';
    end;
    assert early, 'hidden until its seeded appear time';
  end if;
end $$;
rollback;

-- A stored profile time zone, when the column exists, selects the game day. Rolled back.
begin;
alter table public.profiles add column timezone text;
insert into auth.users(id) values ('00000000-0000-0000-0000-00000000e306');
insert into public.profiles(id, timezone) values ('00000000-0000-0000-0000-00000000e306', 'America/New_York');
call pg_temp.freeze_clock('2026-11-06 10:30:00+00');
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000e306', true);
do $$
declare s jsonb := public.get_quest_streak();
begin
  assert s->>'time_zone' = 'America/New_York', s::text;
  assert s->>'today' = '2026-11-06', s::text;
end $$;
rollback;

select 'quest game day smoke passed' as result;
