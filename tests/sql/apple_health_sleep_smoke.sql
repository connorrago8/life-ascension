-- Rolled-back TEST smoke for Apple Health sleep and nutrition.
-- Creates two synthetic users, checks the 5 AM edges, lights-out XP once,
-- duplicate request ids, the meal log at 0 XP, and owner RLS.
-- The caller must ROLLBACK. It does not keep rows. Do not print the token.
begin;

insert into auth.users (id) values
  ('00000000-0000-4000-8000-00000000c501'),
  ('00000000-0000-4000-8000-00000000c502');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000c501', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

do $$
declare
  v_today date := public.quest_today();
  v_issued jsonb;
  v_token text;
  v_hash text;
  v_bad text := encode(extensions.digest(convert_to('la_sleep_' || repeat('z', 43), 'UTF8'), 'sha256'), 'hex');
  v_result jsonb;
  v_rows integer;
  v_xp integer;
  v_meals integer;
  v_ledger integer;
  v_other integer;
  v_start timestamptz;
  v_end timestamptz;
  v_decision jsonb;
begin
  if auth.uid() <> '00000000-0000-4000-8000-00000000c501' then
    raise exception 'auth.uid did not follow the test user';
  end if;

  v_decision := public.apple_health_sleep_decision('2026-11-25T22:45:00-06:00');
  if v_decision->>'game_day' <> '2026-11-25' or (v_decision->>'credit')::boolean is not true then
    raise exception '10:45 PM should credit: %', v_decision;
  end if;
  v_decision := public.apple_health_sleep_decision('2026-11-25T23:30:00-06:00');
  if (v_decision->>'credit')::boolean then
    raise exception '11:30 PM credited: %', v_decision;
  end if;
  v_decision := public.apple_health_sleep_decision('2026-11-26T00:00:00-06:00');
  if v_decision->>'game_day' <> '2026-11-25' or (v_decision->>'credit')::boolean then
    raise exception 'midnight edge failed: %', v_decision;
  end if;
  v_decision := public.apple_health_sleep_decision('2026-11-26T04:59:00-06:00');
  if v_decision->>'game_day' <> '2026-11-25' or (v_decision->>'credit')::boolean then
    raise exception '4:59 AM edge failed: %', v_decision;
  end if;
  if public.apple_health_game_day('2026-11-26T04:59:00-06:00') <> date '2026-11-25'
     or public.apple_health_game_day('2026-11-26T05:00:00-06:00') <> date '2026-11-26' then
    raise exception '5 AM nutrition boundary failed';
  end if;
  v_decision := public.apple_health_sleep_decision('2026-11-26T05:00:00-06:00');
  if v_decision->>'game_day' <> '2026-11-26' or (v_decision->>'in_night')::boolean or (v_decision->>'credit')::boolean then
    raise exception '5:00 AM edge failed: %', v_decision;
  end if;

  v_issued := public.issue_health_ingest_token(false);
  v_token := v_issued->>'token';
  if v_token is null or left(v_token, 9) <> 'la_sleep_' then
    raise exception 'token was not issued';
  end if;
  v_hash := encode(extensions.digest(convert_to(v_token, 'UTF8'), 'sha256'), 'hex');
  v_token := null;

  v_result := public.ingest_apple_health(v_bad, '00000000-0000-4000-8000-00000000d501');
  if v_result->>'error' <> 'unauthorized' then
    raise exception 'bad token was accepted';
  end if;

  v_start := (v_today::timestamp + time '22:45') at time zone 'America/Chicago';
  v_end := ((v_today + 1)::timestamp + time '06:30') at time zone 'America/Chicago';
  v_result := public.ingest_apple_health(
    v_hash, '00000000-0000-4000-8000-00000000d501', v_start, v_end, 'apple_health', 'Oura'
  );
  if (v_result->>'ok')::boolean is not true or (v_result->>'xp_awarded')::int <> 5
     or v_result->'sleep'->>'receipt' <> 'Auto from Apple Health (Oura)' then
    raise exception 'first lights out failed: %', v_result - 'sleep';
  end if;
  v_result := public.ingest_apple_health(
    v_hash, '00000000-0000-4000-8000-00000000d501', v_start, v_end, 'apple_health', 'Oura'
  );
  if (v_result->>'xp_awarded')::int <> 0 then
    raise exception 'duplicate sleep request paid again';
  end if;
  select count(*), coalesce(sum(xp_awarded), 0) into v_rows, v_xp
    from public.health_lights_out where owner_id = auth.uid();
  if v_rows <> 1 or v_xp <> 5 then
    raise exception 'lights out stored % rows and % xp', v_rows, v_xp;
  end if;

  perform public.record_lights_out(v_today - 1, '00000000-0000-4000-8000-00000000d599');
  v_start := ((v_today - 1)::timestamp + time '22:40') at time zone 'America/Chicago';
  v_end := (v_today::timestamp + time '06:00') at time zone 'America/Chicago';
  v_result := public.ingest_apple_health(
    v_hash, '00000000-0000-4000-8000-00000000d502', v_start, v_end, 'apple_health', null
  );
  if (v_result->>'xp_awarded')::int <> 0 then
    raise exception 'manual then auto paid again: %', v_result->'sleep';
  end if;
  select count(*), coalesce(sum(xp_awarded), 0) into v_rows, v_xp
    from public.health_lights_out where owner_id = auth.uid();
  if v_rows <> 2 or v_xp <> 10 then
    raise exception 'manual plus auto was % rows and % xp', v_rows, v_xp;
  end if;

  v_start := ((v_today - 3)::timestamp + time '22:45') at time zone 'America/Chicago';
  v_end := ((v_today - 2)::timestamp + time '06:00') at time zone 'America/Chicago';
  v_result := public.ingest_apple_health(
    v_hash, '00000000-0000-4000-8000-00000000d503', v_start, v_end, 'apple_health', null
  );
  if v_result->>'error' <> 'old_night' then
    raise exception 'old night was not rejected: %', v_result->'sleep';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'health_nutrition_days'
      and column_name in ('fiber_g', 'water_ml', 'dietary_energy_kcal', 'food_logged')
  ) then
    raise exception 'nutrition stored a discarded column';
  end if;

  v_result := public.ingest_cronometer_nutrition(
    v_hash, '00000000-0000-4000-8000-00000000d510',
    v_today, pg_catalog.now(), 'game_window', 'complete',
    1800, 90, 200, 60
  );
  if (v_result->>'xp_awarded')::int <> 0
     or (v_result->'nutrition'->>'energy_kcal')::numeric <> 1800
     or (v_result->'nutrition'->>'protein_g')::numeric <> 90 then
    raise exception 'nutrition was not stored: %', v_result->'nutrition';
  end if;
  select count(*) into v_meals from public.health_meals where owner_id = auth.uid();
  if v_meals <> 0 then raise exception 'nutrition created a meal row'; end if;

  v_result := public.ingest_cronometer_nutrition(
    v_hash, '00000000-0000-4000-8000-00000000d510',
    v_today, pg_catalog.now(), 'game_window', 'complete',
    2500, 10, 10, 10
  );
  if v_result->>'error' <> 'duplicate_request_id' then
    raise exception 'duplicate nutrition request was not rejected';
  end if;
  if (select energy_kcal from public.health_nutrition_days where owner_id = auth.uid() and game_day = v_today) <> 1800 then
    raise exception 'duplicate request changed kcal';
  end if;

  v_result := public.ingest_cronometer_nutrition(
    v_hash, '00000000-0000-4000-8000-00000000d511',
    v_today, pg_catalog.now() + interval '1 minute', 'game_window', 'partial',
    0, null, null, null
  );
  if (select energy_kcal from public.health_nutrition_days where owner_id = auth.uid() and game_day = v_today) <> 0
     or (select protein_g from public.health_nutrition_days where owner_id = auth.uid() and game_day = v_today) <> 90
     or (select count(*) from public.health_nutrition_days where owner_id = auth.uid() and game_day = v_today) <> 1 then
    raise exception 'zero did not replace energy, or null erased protein';
  end if;

  v_result := public.ingest_cronometer_nutrition(
    v_hash, '00000000-0000-4000-8000-00000000d512',
    v_today, pg_catalog.now() - interval '1 day', 'game_window', 'complete',
    9999, 1, 1, 1
  );
  if (v_result->>'stale')::boolean is not true
     or (select energy_kcal from public.health_nutrition_days where owner_id = auth.uid() and game_day = v_today) <> 0 then
    raise exception 'older observation overwrote the day';
  end if;

  select count(*) into v_rows from public.health_lights_out where owner_id = auth.uid();
  if v_rows <> 2 then raise exception 'nutrition changed lights-out rows'; end if;

  select count(*) into v_ledger from public.xp_ledger where owner_id = auth.uid();
  if v_ledger <> 0 then raise exception 'nutrition or lights out wrote xp_ledger'; end if;

  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000c502', true);
  if auth.uid() <> '00000000-0000-4000-8000-00000000c502' then
    raise exception 'could not switch to the second test user';
  end if;
  select count(*) into v_other from public.health_lights_out;
  if v_other <> 0 then raise exception 'second account read lights-out rows'; end if;
  select count(*) into v_other from public.health_nutrition_days;
  if v_other <> 0 then raise exception 'second account read nutrition rows'; end if;
  select count(*) into v_other from public.health_sleep_ingest;
  if v_other <> 0 then raise exception 'second account read sleep rows'; end if;
  select count(*) into v_other from public.health_ingest_tokens_safe;
  if v_other <> 0 then raise exception 'second account read token rows'; end if;
  select count(*) into v_other from public.health_meals;
  if v_other <> 0 then raise exception 'second account read meal rows'; end if;
end $$;

select 'apple_health_sleep_smoke_ok' as ok;

rollback;
