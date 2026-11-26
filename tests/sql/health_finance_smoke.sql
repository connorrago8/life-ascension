-- Rolled-back TEST smoke for Health and Finance. Creates two synthetic users,
-- checks lights-out idempotency, the 5 AM window, nullable meal flags, owner RLS,
-- and the payday guard. The caller must ROLLBACK. It does not keep rows.
begin;

insert into auth.users (id) values
  ('00000000-0000-4000-8000-00000000a501'),
  ('00000000-0000-4000-8000-00000000a502');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a501', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

do $$
declare
  v_today date := public.quest_today();
  v_first jsonb;
  v_second jsonb;
  v_rows int;
  v_xp int;
  v_other int;
  v_meal jsonb;
  v_notes int;
begin
  if auth.uid() <> '00000000-0000-4000-8000-00000000a501' then
    raise exception 'auth.uid did not follow the test user';
  end if;

  v_first := public.record_lights_out(v_today, '00000000-0000-4000-8000-00000000b501');
  if (v_first->>'already')::boolean or (v_first->>'xp_awarded')::int <> 5 then
    raise exception 'first lights out was %', v_first;
  end if;
  v_second := public.record_lights_out(v_today, '00000000-0000-4000-8000-00000000b502');
  if (v_second->>'already')::boolean is not true or (v_second->>'xp_awarded')::int <> 0 then
    raise exception 'second lights out paid again: %', v_second;
  end if;
  select count(*), coalesce(sum(xp_awarded), 0) into v_rows, v_xp
    from public.health_lights_out where owner_id = auth.uid();
  if v_rows <> 1 or v_xp <> 5 then
    raise exception 'lights out stored % rows and % xp', v_rows, v_xp;
  end if;

  begin
    perform public.record_lights_out(v_today - 3, '00000000-0000-4000-8000-00000000b503');
    raise exception 'a night older than 2 game days was accepted';
  exception when others then
    if sqlerrm <> 'Choose an eligible lights-out night' then
      raise exception 'unexpected window error: %', sqlerrm;
    end if;
  end;

  begin
    perform public.save_health_meal(v_today, null, null, null, null);
    raise exception 'a blank meal was stored';
  exception when others then
    if sqlerrm <> 'Blank meal stays unlogged' then
      raise exception 'unexpected blank meal error: %', sqlerrm;
    end if;
  end;

  v_meal := public.save_health_meal(v_today, false, null, null, null);
  if (v_meal->>'xp_awarded')::int <> 0 then
    raise exception 'meal awarded xp: %', v_meal;
  end if;
  if (select balanced is not null and protein is null and produce is null and delivery is null
        from public.health_meals where owner_id = auth.uid() and game_day = v_today) is not true then
    raise exception 'nullable meal flags were not stored';
  end if;

  perform public.save_health_notes(v_today, 'slept', null);

  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a502', true);
  if auth.uid() <> '00000000-0000-4000-8000-00000000a502' then
    raise exception 'could not switch to the second test user';
  end if;
  select count(*) into v_other from public.health_lights_out;
  if v_other <> 0 then raise exception 'second account read % lights-out rows', v_other; end if;
  select count(*) into v_other from public.health_meals;
  if v_other <> 0 then raise exception 'second account read % meal rows', v_other; end if;
  select count(*) into v_notes from public.health_notes;
  if v_notes <> 0 then raise exception 'second account read % note rows', v_notes; end if;
  select count(*) into v_other from public.finance_payday_checks;
  if v_other <> 0 then raise exception 'second account read % payday rows', v_other; end if;

  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a501', true);
  begin
    perform public.complete_payday_check(date '2026-12-03', 'minimum_only', '00000000-0000-4000-8000-00000000b504');
    if public.quest_today() < date '2026-12-03' then
      raise exception 'future payday was completed';
    end if;
  exception when others then
    if public.quest_today() < date '2026-12-03' and sqlerrm <> 'This payday check is not open yet' then
      raise exception 'unexpected payday guard: %', sqlerrm;
    elsif public.quest_today() >= date '2026-12-03' then
      raise;
    end if;
  end;
  begin
    perform public.complete_payday_check(date '2026-12-04', 'minimum_only', '00000000-0000-4000-8000-00000000b505');
    raise exception 'a date off the payday list was accepted';
  exception when others then
    if sqlerrm <> 'Select a scheduled payday' then
      raise exception 'unexpected payday list error: %', sqlerrm;
    end if;
  end;
end $$;

select 'health_finance_smoke_ok' as result;
rollback;
