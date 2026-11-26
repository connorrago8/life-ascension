-- Rolled-back TEST check: unlock gate, one active health follow-up, XP once.
begin;

insert into auth.users (id) values
  ('00000000-0000-4000-8000-00000000a601'),
  ('00000000-0000-4000-8000-00000000a602');

insert into public.health_lights_out (owner_id, game_day, request_id, prior_streak, xp_awarded)
select '00000000-0000-4000-8000-00000000a601', day::date, gen_random_uuid(), 0, 5
from (values
  ('2026-11-16'), ('2026-11-17'), ('2026-11-18'), ('2026-11-19'), ('2026-11-20'), ('2026-11-21'),
  ('2026-11-09'), ('2026-11-10'), ('2026-11-11'), ('2026-11-12'), ('2026-11-13'), ('2026-11-14')
) as nights(day);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a601', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

do $$
declare
  v_today date := public.quest_today();
  v_start jsonb;
  v_done jsonb;
  v_again jsonb;
  v_rows int;
  v_xp int;
  v_other int;
begin
  if v_today < date '2026-11-23' or v_today >= date '2026-11-30' then
    raise exception 'smoke expects a game day in the week of 2026-11-23, got %', v_today;
  end if;
  if not public.health_followups_unlocked('00000000-0000-4000-8000-00000000a601', v_today) then
    raise exception 'two weeks of 6 nights did not unlock';
  end if;
  v_start := public.start_track_template('health', 'easy_walk', '00000000-0000-4000-8000-00000000c601');
  if (v_start->>'xp_awarded')::int <> 0 or v_start->>'status' <> 'in_progress' then
    raise exception 'start paid or did not start: %', v_start;
  end if;
  begin
    perform public.start_track_template('health', 'protein_meal', '00000000-0000-4000-8000-00000000c602');
    raise exception 'a second health follow-up started';
  exception when others then
    if sqlerrm <> 'One health follow-up at a time' then
      raise exception 'unexpected second start: %', sqlerrm;
    end if;
  end;
  v_done := public.complete_track_template('health', 'easy_walk', '00000000-0000-4000-8000-00000000c603');
  if (v_done->>'already')::boolean or (v_done->>'xp_awarded')::int < 1 then
    raise exception 'finish did not pay: %', v_done;
  end if;
  v_again := public.complete_track_template('health', 'easy_walk', '00000000-0000-4000-8000-00000000c604');
  if (v_again->>'already')::boolean is not true or (v_again->>'xp_awarded')::int <> 0 then
    raise exception 'second finish paid: %', v_again;
  end if;
  select count(*), coalesce(sum(amount), 0) into v_rows, v_xp
    from public.xp_ledger where owner_id = '00000000-0000-4000-8000-00000000a601';
  if v_rows <> 1 or v_xp <> (v_done->>'xp_awarded')::int then
    raise exception 'ledger rows % xp % award %', v_rows, v_xp, v_done->>'xp_awarded';
  end if;

  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a602', true);
  select count(*) into v_other from public.track_template_states;
  if v_other <> 0 then raise exception 'second account read % template rows', v_other; end if;
  begin
    perform public.start_track_template('health', 'easy_walk', '00000000-0000-4000-8000-00000000c605');
    raise exception 'locked follow-up started';
  exception when others then
    if sqlerrm <> 'Unlocks later' then
      raise exception 'unexpected lock: %', sqlerrm;
    end if;
  end;
end $$;

select 'track_templates_smoke_ok' as result;
rollback;
