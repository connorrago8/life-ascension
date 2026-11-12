-- Forward repair for TEST databases that already applied the couple/design migrations.
-- No historical shield receipts or XP are changed.
begin;

-- Streak reads MUST be pure: neither a page view nor an XP calculation may spend a shield.
-- Existing confirmed bridges are honored by _quest_streak_fire_at.
create or replace function public.quest_streak_fire(p_owner uuid, p_today date, p_tz text)
returns integer language sql stable set search_path = ''
as $$ select public._quest_streak_fire_at(p_owner, p_today, p_tz) $$;
revoke all on function public.quest_streak_fire(uuid, date, text) from public, anon, authenticated;

-- This is the ONLY shield-spending entrypoint. The UI must show the covered
-- date and call this RPC only after the authenticated player taps "Use Shield".
-- Never call from a background job, status read, or automatic XP award.
create or replace function public.confirm_streak_shield(p_missed_day date)
returns jsonb language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_today date := public.quest_game_day(pg_catalog.now(), 'America/Chicago');
  v_month date;
  v_existing date;
begin
  if v_owner is null then raise exception 'Authentication required'; end if;
  if p_missed_day is null or p_missed_day >= v_today then
    raise exception 'Shield day must be a past game day';
  end if;
  -- The protected day must be an actual one-day gap between qualifying days.
  if public.quest_has_completion_on(v_owner, p_missed_day, 'America/Chicago')
     or not public.quest_has_completion_on(v_owner, p_missed_day - 1, 'America/Chicago')
     or not public.quest_has_completion_on(v_owner, p_missed_day + 1, 'America/Chicago') then
    raise exception 'Shield requires one missed day between completed days';
  end if;
  v_month := pg_catalog.date_trunc('month', p_missed_day)::date;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('streak-shield:' || v_owner::text, 0));
  select bridged_day into v_existing from public.streak_shields
    where owner_id = v_owner and month_key = v_month;
  if v_existing is not null and v_existing <> p_missed_day then
    raise exception 'Monthly shield already used';
  end if;
  insert into public.streak_shields(owner_id, month_key, bridged_day)
    values (v_owner, v_month, p_missed_day)
    on conflict (owner_id, month_key) do nothing;
  return pg_catalog.jsonb_build_object(
    'status', 'used', 'month', v_month, 'bridgedDay', p_missed_day,
    'notice', 'Streak Shield used · 0 remaining. Streak protected. You missed a day, but your journey continues. No XP was awarded.');
end $$;
revoke all on function public.confirm_streak_shield(date) from public, anon;
grant execute on function public.confirm_streak_shield(date) to authenticated;

-- Legacy internal name retained for callers; calculation is strictly read-only.
create or replace function public._streak_shield_sync(p_owner uuid, p_today date, p_tz text)
returns integer language sql stable security definer set search_path = ''
as $$ select public._quest_streak_fire_at(p_owner, p_today, p_tz) $$;
revoke all on function public._streak_shield_sync(uuid, date, text) from public, anon, authenticated, service_role;

create or replace function public._streak_shield_status(p_owner uuid, p_at timestamptz)
returns jsonb language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_today date;
  v_month date;
  v_day date;
  v_notice text;
  v_candidate date;
  v_cursor date;
begin
  if p_owner is null or p_at is null then raise exception 'Authentication required'; end if;
  v_today := public.quest_game_day(p_at, 'America/Chicago');
  -- Read-only status. No implicit shield consumption.
  v_month := public.streak_shield_month(p_at);
  select s.bridged_day into v_day from public.streak_shields s
    where s.owner_id = p_owner and s.month_key = v_month;
  if v_day is null then
    -- Walk the currently connected run; only offer a real one-day gap in
    -- the active allowance month. Merely reading this never writes a receipt.
    v_cursor := v_today - 1;
    while v_cursor >= v_month loop
      if public.quest_has_completion_on(p_owner, v_cursor, 'America/Chicago') then
        v_cursor := v_cursor - 1;
        continue;
      end if;
      if public.quest_has_completion_on(p_owner, v_cursor - 1, 'America/Chicago')
         and public.quest_has_completion_on(p_owner, v_cursor + 1, 'America/Chicago') then
        v_candidate := v_cursor;
      end if;
      exit;
    end loop;
    v_notice := 'Streak Shield ready · 1 this month';
  else
    v_notice := 'Streak Shield used · 0 remaining. Streak protected. You missed a day, but your journey continues. No XP was awarded.';
  end if;
  return pg_catalog.jsonb_build_object(
    'status', case when v_day is null then 'ready' else 'used' end,
    'month', v_month,
    'bridgedDay', v_day,
    'eligibleMissedDay', v_candidate,
    'doneToday', public.quest_has_completion_on(p_owner, v_today, 'America/Chicago'),
    'notice', v_notice);
end $$;
revoke all on function public._streak_shield_status(uuid, timestamptz) from public, anon, authenticated, service_role;

create or replace function public.get_streak_shield()
returns jsonb language plpgsql volatile security definer set search_path = ''
as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'Authentication required'; end if;
  return public._streak_shield_status(u, pg_catalog.now());
end $$;
revoke all on function public.get_streak_shield() from public, anon;
grant execute on function public.get_streak_shield() to authenticated;


notify pgrst, 'reload schema';
commit;
