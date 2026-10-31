-- Wellness readings RLS + upsert smoke. Runs in one transaction and ROLLS BACK, so it leaves no rows.
-- Safe on a disposable Postgres or the TEST project only; never run against Production.
begin;
do $smoke$
declare
  a uuid := '00000000-0000-4000-8000-00000000a001';
  b uuid := '00000000-0000-4000-8000-00000000b002';
  today date := (now() at time zone 'America/Chicago')::date;
  n integer;
  v_sleep numeric;
  v_steps integer;
begin
  insert into auth.users (id, email, aud, role) values
    (a, 'wellness-a@example.invalid', 'authenticated', 'authenticated'),
    (b, 'wellness-b@example.invalid', 'authenticated', 'authenticated');

  -- User A records a reading, then upserts the same date (steps only keeps sleep).
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', a::text, true);
  perform set_config('role', 'authenticated', true);
  perform * from public.record_wellness_reading(today, 7.25, 8000, 'apple_health_shortcut');
  perform * from public.record_wellness_reading(today, null, 9100, 'apple_health_shortcut');
  select count(*), max(sleep_hours), max(steps) into n, v_sleep, v_steps from public.wellness_readings;
  if n <> 1 or v_sleep <> 7.25 or v_steps <> 9100 then raise exception 'upsert by date failed: % % %', n, v_sleep, v_steps; end if;

  -- Validation.
  begin perform * from public.record_wellness_reading(today, 24.5, null, null); raise exception 'sleep>24 accepted';
  exception when sqlstate '22023' then null; end;
  begin perform * from public.record_wellness_reading(today, null, 200001, null); raise exception 'steps>200000 accepted';
  exception when sqlstate '22023' then null; end;
  begin perform * from public.record_wellness_reading(today, null, -1, null); raise exception 'negative steps accepted';
  exception when sqlstate '22023' then null; end;
  begin perform * from public.record_wellness_reading(today + 5, 7, null, null); raise exception 'future date accepted';
  exception when sqlstate '22023' then null; end;
  begin perform * from public.record_wellness_reading(today, null, null, null); raise exception 'empty reading accepted';
  exception when sqlstate '22023' then null; end;

  -- Clients cannot write the table directly or call the service-role wrapper.
  begin insert into public.wellness_readings (user_id, reading_date, steps) values (a, today - 1, 5); raise exception 'direct insert allowed';
  exception when insufficient_privilege then null; end;
  begin update public.wellness_readings set steps = 1; raise exception 'direct update allowed';
  exception when insufficient_privilege then null; end;
  begin perform * from public.record_wellness_reading_as_user(b, today, 1, 1, null); raise exception 'as_user callable by authenticated';
  exception when insufficient_privilege then null; end;

  -- User B sees none of A's rows (RLS) and writes only its own.
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', b::text, true);
  perform set_config('role', 'authenticated', true);
  select count(*) into n from public.wellness_readings;
  if n <> 0 then raise exception 'RLS leak: user B sees % rows', n; end if;
  perform * from public.record_wellness_reading(today - 1, 6.5, null, null);
  select count(*) into n from public.wellness_readings;
  if n <> 1 then raise exception 'user B should see exactly its own row, saw %', n; end if;

  -- anon sees nothing and cannot write.
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('role', 'anon', true);
  begin select count(*) into n from public.wellness_readings; raise exception 'anon can read wellness_readings';
  exception when insufficient_privilege then null; end;
  begin perform * from public.record_wellness_reading(today, 7, null, null); raise exception 'anon can record';
  exception when insufficient_privilege then null; end;

  -- service_role wrapper writes for the bound user only.
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('role', 'service_role', true);
  perform * from public.record_wellness_reading_as_user(a, today - 2, 8, 12000, 'apple_health_shortcut');
  select count(*) into n from public.wellness_readings where user_id = a;
  if n <> 2 then raise exception 'as_user wrapper did not write for user A (% rows)', n; end if;
  select count(*) into n from public.wellness_readings where user_id = b;
  if n <> 1 then raise exception 'as_user wrapper touched user B'; end if;
  perform set_config('role', 'postgres', true);
  raise notice 'WELLNESS_SMOKE_PASS';
end
$smoke$;
rollback;
