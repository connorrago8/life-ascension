-- Versioned companion activity log. TEST only. Not applied yet, so this file is the definition.
-- Reverse with supabase/rollbacks/202611110005_companion_log_activity_v2_down.sql.
-- Original companion_log_activity(uuid, text, text) is unchanged and still uses quest XP.
--
-- Izzy activity XP is separate from Connor's quest XP:
--   * Awarded only to the companion (subject), never the inviter.
--   * Fixed tiers: small 5, medium 10, big 20. Not the streak-scaled quest formula.
--   * Duration adjustment, server-side, one step, capped at 5 and 20:
--       Long (>= 60 minutes): the text contains hour, 1hr, 60 min, 90 min, or 2 hr.
--       Short (<= 10 minutes): quick, 5 min, 10 min, or ten min.
--       A hint that starts with a digit must not continue a longer number
--       ("10 min" does not match inside "110 min"). The first eligible match counts.
--       Long and short together leave the tier unchanged.
--       Null or unknown p_tier starts at medium (10), then the duration step applies.
--   * No xp_ledger row, no quest, no quest instance. Quest streak reads xp_ledger only,
--     so an activity cannot feed Connor's streak or Izzy's quest streak.
--   * The amount is stored on companion_activities.xp_awarded and added by
--     _companion_lifetime_xp when ledger_id is null and the row is not voided.
--   * Game day is quest_game_day for the companion (profile timezone, else America/Chicago),
--     the same 05:00 boundary quests use. p_recorded_on null means that game day.
--     A later calendar date than the game day is rejected. Dates older than 30 game days
--     are rejected.
--   * Reusing a request id with a different normalized title raises
--     'Request ID reused with different payload'. The same request and title returns already.
--   * One open award per companion, normalized title, and game day (dedupe_key).

alter table public.companion_activities
  add column if not exists xp_awarded integer not null default 0;
alter table public.companion_activities drop constraint if exists companion_activities_xp_awarded_check;
alter table public.companion_activities add constraint companion_activities_xp_awarded_check
  check (xp_awarded in (0, 5, 10, 20));

create or replace function public._companion_lifetime_xp(p_owner uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select (
    coalesce((select sum(amount) from public.xp_ledger where owner_id = p_owner), 0)
    + coalesce((select sum(amount) from public.xp_ledger_adjustments where owner_id = p_owner), 0)
    + coalesce((
      select sum(xp_awarded) from public.companion_activities
      where subject_id = p_owner and voided_at is null and ledger_id is null
    ), 0)
  )::bigint
$$;
revoke all on function public._companion_lifetime_xp(uuid) from public, anon, authenticated, service_role;

create or replace function public.companion_void_activity(p_activity uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  u uuid := auth.uid();
  a public.companion_activities%rowtype;
  v_amount integer;
begin
  if u is null then raise exception 'Sign-in required'; end if;
  select * into a from public.companion_activities where id = p_activity for update;
  if not found or u not in (a.recorded_by, a.subject_id) then raise exception 'Activity not found'; end if;
  if a.voided_at is not null then
    return jsonb_build_object('voided', true, 'already', true);
  end if;
  if a.ledger_id is null then
    if a.xp_awarded is null or a.xp_awarded < 1 then raise exception 'Activity not found'; end if;
    update public.companion_activities
      set voided_at = pg_catalog.now(), voided_by = u
      where id = a.id;
    return jsonb_build_object('voided', true, 'already', false, 'reversed', a.xp_awarded);
  end if;
  select amount into v_amount from public.xp_ledger where id = a.ledger_id and owner_id = a.subject_id;
  if v_amount is null or v_amount < 1 then raise exception 'Activity not found'; end if;
  insert into public.xp_ledger_adjustments(owner_id, ledger_id, amount, reason)
    values (a.subject_id, a.ledger_id, -v_amount, 'companion_activity_void')
    on conflict (ledger_id) do nothing;
  update public.companion_activities
    set voided_at = pg_catalog.now(), voided_by = u
    where id = a.id;
  return jsonb_build_object('voided', true, 'already', false, 'reversed', v_amount);
end $$;
revoke all on function public.companion_void_activity(uuid) from public, anon;
grant execute on function public.companion_void_activity(uuid) to authenticated;

create or replace function public.companion_log_activity_v2(
  p_request uuid,
  p_title text,
  p_note text,
  p_tier text default null,
  p_recorded_on date default null
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  u uuid := auth.uid();
  b public.companion_bonds%rowtype;
  v_title text := btrim(p_title);
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_day date;
  v_today date;
  v_key text;
  v_text text;
  v_long boolean;
  v_short boolean;
  existing public.companion_activities%rowtype;
  v_id uuid;
  v_xp integer := 10;
  v_tier text;
  v_tz text;
begin
  if u is null then raise exception 'Sign-in required'; end if;
  if p_request is null then raise exception 'Invalid activity'; end if;
  select * into b from public.companion_bonds where status = 'active' and inviter_id = u for update;
  if not found or b.companion_id is null then raise exception 'Companion connection required'; end if;
  if v_title is null or char_length(v_title) not between 1 and 120 then raise exception 'Invalid title'; end if;
  if v_note is not null and char_length(v_note) > 500 then raise exception 'Invalid note'; end if;

  if p_tier = 'small' then v_xp := 5;
  elsif p_tier = 'big' then v_xp := 20;
  else v_xp := 10;
  end if;

  v_text := lower(v_title || ' ' || coalesce(v_note, ''));
  v_long := position('hour' in v_text) > 0
    or v_text ~ '(^|[^0-9])1hr'
    or v_text ~ '(^|[^0-9])60 min'
    or v_text ~ '(^|[^0-9])90 min'
    or v_text ~ '(^|[^0-9])2 hr';
  v_short := position('quick' in v_text) > 0
    or position('ten min' in v_text) > 0
    or v_text ~ '(^|[^0-9])5 min'
    or v_text ~ '(^|[^0-9])10 min';
  if v_long and not v_short then
    if v_xp = 5 then v_xp := 10; elsif v_xp = 10 then v_xp := 20; end if;
  elsif v_short and not v_long then
    if v_xp = 20 then v_xp := 10; elsif v_xp = 10 then v_xp := 5; end if;
  end if;
  v_tier := case v_xp when 5 then 'small' when 20 then 'big' else 'medium' end;

  v_tz := public.quest_timezone(b.companion_id);
  v_today := public.quest_game_day(pg_catalog.now(), v_tz);
  v_day := coalesce(p_recorded_on, v_today);
  if v_day > v_today then
    raise exception 'Future date';
  end if;
  if v_day < (v_today - 30) then
    raise exception 'Backdate too far';
  end if;

  select * into existing from public.companion_activities where recorded_by = u and request_id = p_request;
  if found then
    if public.companion_title_key(existing.title) is distinct from public.companion_title_key(v_title) then
      raise exception 'Request ID reused with different payload';
    end if;
    return jsonb_build_object('activityId', existing.id, 'already', true, 'xpAwarded', 0, 'voided', existing.voided_at is not null);
  end if;

  v_key := b.companion_id::text || ':' || public.companion_title_key(v_title) || ':' || v_day::text;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('companion-activity:' || v_key, 0));
  select * into existing from public.companion_activities
    where subject_id = b.companion_id and dedupe_key = v_key and voided_at is null;
  if found then
    return jsonb_build_object('activityId', existing.id, 'already', true, 'xpAwarded', 0, 'voided', false);
  end if;

  insert into public.companion_activities(
    bond_id, subject_id, recorded_by, request_id, title, note, dedupe_key, xp_awarded)
    values (b.id, b.companion_id, u, p_request, v_title, v_note, v_key, v_xp)
    returning id into v_id;

  return jsonb_build_object(
    'activityId', v_id, 'already', false, 'xpAwarded', v_xp, 'tier', v_tier, 'day', v_day, 'voided', false);
end $$;
revoke all on function public.companion_log_activity_v2(uuid, text, text, text, date) from public, anon;
grant execute on function public.companion_log_activity_v2(uuid, text, text, text, date) to authenticated;

notify pgrst, 'reload schema';
