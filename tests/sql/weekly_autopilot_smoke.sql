-- Weekly autopilot smoke. Disposable Postgres only, after every migration.
-- Work-task titles only. No personal health records.
-- Plain SQL: the caller sets ON_ERROR_STOP. No psql meta-commands.

insert into auth.users(id) values
 ('00000000-0000-0000-0000-00000000f101'),
 ('00000000-0000-0000-0000-00000000f102'),
 ('00000000-0000-0000-0000-00000000f103');

insert into public.profiles(id, timezone) values
 ('00000000-0000-0000-0000-00000000f101', 'America/Chicago');

-- Sunday 23:59 vs Monday 00:00 in America/Chicago, and not the 05:00 quest-board day.
do $$
declare
  sun timestamptz := (timestamp '2026-11-01 23:59:00' at time zone 'America/Chicago');
  mon timestamptz := (timestamp '2026-11-02 00:00:00' at time zone 'America/Chicago');
  five timestamptz := (timestamp '2026-11-02 05:00:00' at time zone 'America/Chicago');
begin
  assert (sun at time zone 'America/Chicago')::date = date '2026-11-01', 'Sunday 23:59 local date';
  assert (mon at time zone 'America/Chicago')::date = date '2026-11-02', 'Monday 00:00 local date';
  assert public.quest_week_start((sun at time zone 'America/Chicago')::date) = date '2026-10-26', 'Sunday 23:59 is the previous week';
  assert public.quest_week_start((mon at time zone 'America/Chicago')::date) = date '2026-11-02', 'Monday 00:00 starts the new week';
  assert sun < mon and mon < five, 'midnight is before 05:00';
  assert ((mon - interval '5 hours') at time zone 'America/Chicago')::date = date '2026-11-01', '05:00 roll would still be Sunday';
  assert position('5 hours' in pg_get_functiondef('public.ensure_quest_instance(uuid,date)'::regprocedure)) = 0, 'ensure uses local midnight, not the 05:00 bulk path';
  assert position('5 hours' in pg_get_functiondef('public.quest_board_v3_ensure_instances(date)'::regprocedure)) > 0, 'bulk path still has the 05:00 day';
  assert public.quest_weekly_appears_at('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000d0a1', '2026-10-26', 'America/Chicago')
    = '2026-10-28 16:47:00+00'::timestamptz, 'random reveal hash unchanged';
end $$;

-- Pack, idempotent instances, +1 XP once, week boundary reveal, edit, remove.
do $$
declare
  u uuid := '00000000-0000-0000-0000-00000000f101';
  v_today date;
  v_week date;
  v_added integer;
  v_count integer;
  q uuid;
  q_done uuid;
  q_edit uuid;
  i uuid;
  i2 uuid;
  r jsonb;
  ok boolean;
  v_xp integer;
  v_rows integer;
  v_title text;
  v_due date;
  v_dow integer;
  v_wed date;
  appears timestamptz;
  expected timestamptz;
begin
  v_today := (pg_catalog.now() at time zone 'America/Chicago')::date;
  v_week := public.quest_week_start(v_today);
  perform set_config('request.jwt.claim.sub', u::text, true);
  set local role authenticated;

  v_added := public.apply_pharmacy_weekly_pack();
  assert v_added = 6, 'first pack adds 6';
  v_added := public.apply_pharmacy_weekly_pack();
  assert v_added = 0, 'second pack adds nothing';
  select count(*) into v_count from public.quests
   where owner_id = u and active and cadence = 'weekly' and domain = 'career' and fixed_reveal is true and weekly_weekday = 1;
  assert v_count = 6, 'still 6 Monday career quests';
  select count(*) into v_count from public.quests
   where owner_id = u and active and scheduled_for = v_week
     and title in ('Tech schedule','Pharmacist schedule','Supplies order','U Learn check','Attendance check','PTO check');
  assert v_count = 6, 'scheduled_for is this week''s Monday and titles match';

  for q in select id from public.quests where owner_id = u and cadence = 'weekly' order by title loop
    i := public.ensure_quest_instance(q, v_today);
    i2 := public.ensure_quest_instance(q, v_today);
    assert i = i2 and i is not null, 'ensure twice returns one instance';
    i2 := public.ensure_quest_instance(q, v_week);
    assert i = i2, 'week start and today are the same instance';
    select due_date into v_due from public.quest_instances where id = i;
    assert v_due = v_week, 'weekly due date is Monday';
    select count(*) into v_count from public.quest_instances where quest_id = q and due_date = v_week;
    assert v_count = 1, 'one row per quest per week';
  end loop;

  select id into q_done from public.quests where owner_id = u and title = 'Tech schedule';
  i := public.ensure_quest_instance(q_done, v_today);
  r := public.set_quest_instance_status_v2(i, 'complete');
  assert r->>'reward_status' = 'awarded' and (r->>'xp_awarded')::int = 1, r::text;
  r := public.set_quest_instance_status_v2(i, 'complete');
  assert r->>'reward_status' = 'already_awarded' and (r->>'xp_awarded')::int = 0, 'second complete awards 0';
  select count(*)::int, coalesce(sum(amount), 0)::int into v_rows, v_xp from public.xp_ledger where instance_id = i;
  assert v_rows = 1 and v_xp = 1, 'ledger is +1 once';

  reset role;
  insert into public.quest_instances(owner_id, quest_id, due_date)
  values (u, q_done, v_week - 7);
  set local role authenticated;
  select id into i2 from public.quest_instances where quest_id = q_done and due_date = v_week - 7;
  ok := false;
  begin
    perform public.set_quest_instance_status_v2(i2, 'complete');
  exception when raise_exception then
    ok := sqlerrm = 'Weekly quests can only be completed during their own week';
  end;
  assert ok, 'uncompleted prior week cannot be completed and does not carry over';
  assert (select status from public.quest_instances where id = i2) = 'available', 'missed week stays open with no penalty status';
  assert (select count(*) from public.xp_ledger where instance_id = i2) = 0, 'missed week awards no XP';
  select count(*)::int, coalesce(sum(amount), 0)::int into v_rows, v_xp from public.xp_ledger where owner_id = u;
  assert v_rows = 1 and v_xp = 1, 'no penalty row';

  select id into q_edit from public.quests where owner_id = u and title = 'Attendance check';
  perform public.rename_quest(q_edit, 'Attendance check renamed');
  select title into v_title from public.quests where id = q_edit;
  assert v_title = 'Attendance check renamed', 'rename updates the quest';
  i := public.ensure_quest_instance(q_edit, v_today);
  select q.title into v_title from public.quests q join public.quest_instances qi on qi.quest_id = q.id where qi.id = i;
  assert v_title = 'Attendance check renamed', 'current instance shows the new title';
  reset role;
  insert into public.quest_instances(owner_id, quest_id, due_date) values (u, q_edit, v_week + 7);
  set local role authenticated;
  select q.title into v_title
    from public.quests q join public.quest_instances qi on qi.quest_id = q.id
   where qi.quest_id = q_edit and qi.due_date = v_week + 7;
  assert v_title = 'Attendance check renamed', 'rename persists to the next week instance';
  select id into i2 from public.quest_instances where quest_id = q_edit and due_date = v_week + 7;
  ok := false;
  begin
    perform public.set_quest_instance_status_v2(i2, 'complete');
  exception when raise_exception then
    ok := sqlerrm = 'Weekly quests can only be completed during their own week';
  end;
  assert ok, 'next week is its own instance and is not completable early';
  select count(*) into v_count from public.quest_instances where quest_id = q_edit and due_date = v_week;
  assert v_count = 1, 'this week is still one row';

  v_wed := v_today + ((3 - pg_catalog.date_part('isodow', v_today)::int + 7) % 7);
  perform public.reschedule_quest(q_edit, v_wed);
  select weekly_weekday, scheduled_for into v_dow, v_due from public.quests where id = q_edit;
  assert v_dow = 3 and v_due = v_wed, 'edit stores the new weekday';
  select due_date into v_due from public.quest_instances where quest_id = q_edit and due_date = v_week;
  assert v_due = v_week, 'edit does not move the week key';

  perform public.archive_quest(q_done);
  assert (select active from public.quests where id = q_done) = false, 'remove deactivates';
  select count(*)::int, coalesce(sum(amount), 0)::int into v_rows, v_xp from public.xp_ledger where instance_id = i and owner_id = u;
  -- i was rebound to the renamed quest. Re-read the completed tech instance.
  select qi.id into i from public.quest_instances qi
    join public.quests q on q.id = qi.quest_id
   where q.id = q_done and qi.due_date = v_week and qi.status = 'completed';
  select count(*)::int, coalesce(sum(amount), 0)::int into v_rows, v_xp from public.xp_ledger where instance_id = i;
  assert v_rows = 1 and v_xp = 1, 'remove keeps the +1 XP';
  select count(*) into v_count from public.quest_instances where quest_id = q_done;
  ok := false;
  begin
    perform public.ensure_quest_instance(q_done, v_today);
  exception when raise_exception then
    ok := sqlerrm = 'Quest not found';
  end;
  assert ok, 'archived quest does not open a future instance';
  assert (select count(*) from public.quest_instances where quest_id = q_done) = v_count, 'remove does not delete history';

  q := public.create_scheduled_quest('Random weekly fold', 'home', 'weekly', v_today, 'scheduled');
  assert (select fixed_reveal from public.quests where id = q) is null, 'unflagged weekly stays random';
  assert (select weekly_weekday from public.quests where id = q) is null, 'unflagged weekly has no weekday';

  q := public.create_weekly_autopilot_quest('Window check', 'career', 3);
  assert (select count(*) from public.quest_instances where quest_id = q) = 0, 'autopilot quest waits for ensure';
  v_dow := pg_catalog.date_part('isodow', v_today)::int;
  i := public.ensure_quest_instance(q, v_today);
  if v_dow < 3 then
    assert i is null, 'Wednesday quest has no instance before Wednesday';
    assert (select count(*) from public.quest_instances where quest_id = q) = 0, 'no early row';
  else
    assert i is not null, 'Wednesday quest opens once that day has started';
    assert (select due_date from public.quest_instances where id = i) = v_week, 'still keyed by Monday';
    i2 := public.ensure_quest_instance(q, v_today);
    assert i2 = i, 'second ensure does not duplicate';
  end if;

  reset role;
  select id into q from public.quests where owner_id = u and title = 'PTO check';
  assert public.quest_weekly_appears_at(u, q, v_week, 'America/Chicago')
    = (v_week::timestamp at time zone 'America/Chicago'), 'fixed reveal is Monday 00:00 in the player zone';
  assert public.quest_weekly_appears_at(u, q, date '2026-11-02', 'America/Chicago')
    = (timestamp '2026-11-02 00:00:00' at time zone 'America/Chicago'), 'Nov 2 Monday 00:00 Chicago';
  assert public.quest_weekly_appears_at(u, q, date '2026-11-02', 'America/New_York')
    = (timestamp '2026-11-02 00:00:00' at time zone 'America/New_York'), 'Nov 2 Monday 00:00 New York';
  assert (timestamp '2026-11-02 00:00:00' at time zone 'America/Chicago')
    <> (timestamp '2026-11-02 00:00:00' at time zone 'America/New_York'), 'zones differ';
  select id into q from public.quests where owner_id = u and title = 'Random weekly fold';
  appears := public.quest_weekly_appears_at(u, q, v_week, 'America/Chicago');
  expected := ((v_week::timestamp
    + pg_catalog.make_interval(mins => (public.quest_fnv1a(u::text || ':' || q::text || ':' || v_week::text) % 5040)::integer))
    at time zone 'America/Chicago');
  assert appears = expected, 'random reveal formula unchanged';
  ok := false;
  begin
    insert into public.quest_instances(owner_id, quest_id, due_date)
    select owner_id, id, v_week from public.quests where owner_id = u and title = 'Pharmacist schedule';
  exception when unique_violation then
    ok := true;
  end;
  assert ok, 'unique (quest_id, due_date) blocks a second row for the week';
end $$;

-- Applying the pack to one user does not require that user to be signed in, and players cannot target someone else.
do $$
declare
  admin_target uuid := '00000000-0000-0000-0000-00000000f102';
  v_added integer;
  v_count integer;
  ok boolean := false;
begin
  set local role service_role;
  v_added := public.apply_pharmacy_weekly_pack_for_user(admin_target);
  assert v_added = 6, 'admin pack adds 6';
  v_added := public.apply_pharmacy_weekly_pack_for_user(admin_target);
  assert v_added = 0, 'admin pack is idempotent';
  reset role;
  select count(*) into v_count from public.quests where owner_id = admin_target and active and cadence = 'weekly';
  assert v_count = 6, 'admin apply twice stays at 6';
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000f101', true);
  set local role authenticated;
  begin
    perform public.apply_pharmacy_weekly_pack_for_user(admin_target);
  exception when insufficient_privilege then
    ok := true;
  end;
  assert ok, 'signed-in player cannot apply the pack to another user';
end $$;

-- Skip an existing active title, ignore an inactive one, and keep pack quests out of companion dedupe.
do $$
declare
  u uuid := '00000000-0000-0000-0000-00000000f103';
  v_today date := (pg_catalog.now() at time zone 'America/Chicago')::date;
  v_added integer;
  v_count integer;
  v_daily uuid;
  v_pack uuid;
  v_linked uuid;
  v_again uuid;
  v_fold uuid;
  v_domain text;
  v_cadence text;
begin
  insert into public.quests(owner_id, title, domain, cadence, xp, active)
  values (u, 'Tech schedule', 'career', 'once', 1, false);
  insert into public.quests(owner_id, title, domain, cadence, scheduled_for, quest_type, xp, active)
  values (u, 'pto   check', 'home', 'daily', v_today, 'scheduled', 1, true);
  perform set_config('request.jwt.claim.sub', u::text, true);
  set local role authenticated;
  v_added := public.apply_pharmacy_weekly_pack();
  assert v_added = 5, 'pack skips the active title and still adds the inactive title''s name';
  v_added := public.apply_pharmacy_weekly_pack();
  assert v_added = 0, 'third logical apply still adds 0';
  select count(*) into v_count from public.quests
   where owner_id = u and active and lower(pg_catalog.regexp_replace(pg_catalog.btrim(title), '[[:space:]]+', ' ', 'g')) = 'pto check';
  assert v_count = 1, 'one active PTO check';
  select count(*) into v_count from public.quests
   where owner_id = u and active and cadence = 'weekly' and domain = 'career' and fixed_reveal is true;
  assert v_count = 5, 'five new weekly quests';
  select count(*) into v_count from public.quests
   where owner_id = u and lower(pg_catalog.regexp_replace(pg_catalog.btrim(title), '[[:space:]]+', ' ', 'g')) = 'tech schedule';
  assert v_count = 2, 'inactive row did not block a new active quest';

  select id into v_daily from public.quests
   where owner_id = u and active and cadence = 'daily'
     and lower(pg_catalog.regexp_replace(pg_catalog.btrim(title), '[[:space:]]+', ' ', 'g')) = 'pto check';
  select id into v_pack from public.quests
   where owner_id = u and cadence = 'weekly' and title = 'Supplies order';
  insert into public.quest_companions(id, owner_id, display_name, consent_confirmed_at)
  values ('b0000000-0000-4000-8000-00000000f103', u, 'Work buddy', pg_catalog.now());
  v_linked := public.quest_companion_assign_to_owner('b0000000-0000-4000-8000-00000000f103', 'PTO check');
  assert v_linked = v_daily, 'companion matches the ordinary quest, not a weekly pack title that was skipped';
  v_linked := public.quest_companion_assign_to_owner('b0000000-0000-4000-8000-00000000f103', 'Supplies order');
  assert v_linked <> v_pack, 'companion does not attach to the weekly work quest';
  select domain, cadence into v_domain, v_cadence from public.quests where id = v_linked;
  assert v_domain = 'relationships' and v_cadence = 'once', 'companion created its own quest';
  v_again := public.quest_companion_assign_to_owner('b0000000-0000-4000-8000-00000000f103', 'Supplies order');
  assert v_again = v_linked, 'the new companion quest still dedupes';
  assert not exists (
    select 1 from public.quest_companion_assignments a
    join public.quests q on q.id = a.quest_id
    where a.owner_id = u and (q.fixed_reveal is true or (q.cadence = 'weekly' and q.domain = 'career'))
  ), 'no assignment points at a pack or autopilot quest';

  v_fold := public.create_scheduled_quest('Fold Laundry', 'home', 'daily', v_today);
  v_linked := public.quest_companion_assign_to_owner('b0000000-0000-4000-8000-00000000f103', ' fold   laundry ');
  assert v_linked = v_fold, 'ordinary title dedupe still matches';
end $$;

select 'weekly autopilot smoke passed' as result;
