-- Rolled-back smoke for the nutrition diary. The caller must ROLLBACK.
-- Requires public.quest_game_day and the nutrition migration. Does not keep rows.
begin;

insert into auth.users (id) values
  ('00000000-0000-4000-8000-00000000c501'),
  ('00000000-0000-4000-8000-00000000c502');

insert into public.nutrition_ai_grants (owner_id, assistant, label, token_hash, scopes)
values (
  '00000000-0000-4000-8000-00000000c501',
  'grok',
  'disabled',
  repeat('ab', 32),
  array['nutrition:summary']
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000c501', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

do $$
declare
  v_today date := public.quest_game_day(pg_catalog.now(), 'America/Chicago');
  v_first jsonb;
  v_second jsonb;
  v_rows int;
  v_items int;
  v_xp int;
  v_other int;
  v_saved uuid;
  v_entry uuid;
begin
  if auth.uid() <> '00000000-0000-4000-8000-00000000c501' then
    raise exception 'auth.uid did not follow the test user';
  end if;

  v_first := public.confirm_nutrition_entry(
    '00000000-0000-4000-8000-00000000d501', v_today, 'Breakfast', null, '2 eggs',
    '[{"name":"Eggs","quantity":2,"unit":"large","calories":144,"protein_g":12,"carbs_g":0.8,"fat_g":10,"fiber_g":0,"fluid_oz":null,"source":"generic","confidence":"stated","assumption":"Assumed 2 eggs"}]'::jsonb,
    pg_catalog.now() - interval '5 seconds', null, 'text'
  );
  if (v_first->>'already')::boolean or (v_first->>'xp_awarded')::int <> 0 then
    raise exception 'first confirm was %', v_first;
  end if;
  v_second := public.confirm_nutrition_entry(
    '00000000-0000-4000-8000-00000000d501', v_today, 'Breakfast', null, 'changed',
    '[{"name":"Eggs","quantity":9,"unit":"large","calories":999,"protein_g":1,"carbs_g":1,"fat_g":1,"source":"generic","confidence":"stated"}]'::jsonb,
    null, null, 'text'
  );
  if (v_second->>'already')::boolean is not true or (v_second->>'xp_awarded')::int <> 0 then
    raise exception 'retry created another meal: %', v_second;
  end if;
  select count(*) into v_rows from public.nutrition_entries;
  select count(*), coalesce(sum(calories), 0) into v_items, v_xp from public.nutrition_items;
  if v_rows <> 1 or v_items <> 1 or v_xp <> 144 then
    raise exception 'idempotent save stored % meals, % items, % calories', v_rows, v_items, v_xp;
  end if;

  v_entry := (v_first->>'entry_id')::uuid;
  perform public.update_nutrition_entry(
    v_entry, v_today, 'Breakfast', null,
    '[{"name":"Eggs","quantity":1,"unit":"large","calories":72,"protein_g":6,"carbs_g":0.4,"fat_g":5,"source":"user_edited","confidence":"stated"}]'::jsonb
  );
  select sum(calories) into v_xp from public.nutrition_items;
  if v_xp <> 72 then raise exception 'edit did not update calories: %', v_xp; end if;

  perform public.save_nutrition_favorite(v_entry, 'Usual breakfast', 'my usual breakfast');
  perform public.log_saved_meal(
    (select id from public.saved_meals where owner_id = auth.uid() limit 1),
    v_today, '00000000-0000-4000-8000-00000000d502', pg_catalog.now()
  );
  perform public.log_saved_meal(
    (select id from public.saved_meals where owner_id = auth.uid() limit 1),
    v_today, '00000000-0000-4000-8000-00000000d502', pg_catalog.now()
  );
  select count(*) into v_rows from public.nutrition_entries;
  if v_rows <> 2 then raise exception 'favorite re-log stored % meals', v_rows; end if;

  begin
    perform public.confirm_nutrition_entry(
      '00000000-0000-4000-8000-00000000d503', v_today + 1, 'Meal', null, 'future',
      '[{"name":"Eggs","quantity":1,"unit":"large","calories":72,"protein_g":6,"carbs_g":0,"fat_g":5,"source":"generic","confidence":"stated"}]'::jsonb,
      null, null, 'text'
    );
    raise exception 'a future diary date was accepted';
  exception when others then
    if sqlerrm <> 'Choose a diary date from this game day or the previous 14' then
      raise exception 'unexpected date error: %', sqlerrm;
    end if;
  end;

  begin
    perform public.read_nutrition_for_grant(repeat('ab', 32), v_today);
    raise exception 'revoked nutrition reader was callable';
  exception when insufficient_privilege then
    null;
  end;

  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000c502', true);
  if auth.uid() <> '00000000-0000-4000-8000-00000000c502' then
    raise exception 'could not switch users';
  end if;
  select count(*) into v_other from public.nutrition_entries;
  if v_other <> 0 then raise exception 'second account read % meals', v_other; end if;
  select count(*) into v_other from public.nutrition_items;
  if v_other <> 0 then raise exception 'second account read % items', v_other; end if;
  select count(*) into v_other from public.saved_meals;
  if v_other <> 0 then raise exception 'second account read % favorites', v_other; end if;
  select count(*) into v_other from public.nutrition_ai_grants;
  if v_other <> 0 then raise exception 'second account read % grants', v_other; end if;
  select count(*) into v_other from public.nutrition_aliases;
  if v_other <> 0 then raise exception 'second account read % aliases', v_other; end if;
end $$;

select 'nutrition_diary_smoke_ok' as result;
rollback;
