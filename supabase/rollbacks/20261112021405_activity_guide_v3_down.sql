-- Restores companion_log_activity_v2 to the content-pack duration bands.
-- Does not delete activity rows.

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
  v_minutes integer;
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
  if p_tier is not null and p_tier not in ('small', 'medium', 'big') then
    raise exception 'Invalid tier';
  end if;

  v_text := lower(v_title || ' ' || coalesce(v_note, ''));
  v_minutes := nullif((regexp_match(v_text, '(^|[^0-9])([0-9]+)[[:space:]]*min'))[2], '')::integer;
  if v_minutes is null and v_text ~ '(^|[^0-9])2 hr' then v_minutes := 120;
  elsif v_minutes is null and (position('hour' in v_text) > 0 or v_text ~ '(^|[^0-9])1hr') then v_minutes := 60;
  end if;
  if v_minutes is not null then
    if v_minutes < 15 then v_xp := 5;
    elsif v_minutes < 45 then v_xp := 10;
    else v_xp := 20;
    end if;
  elsif p_tier = 'small' then v_xp := 5;
  elsif p_tier = 'big' then v_xp := 20;
  elsif p_tier = 'medium' then v_xp := 10;
  elsif position('deep clean' in v_text) > 0 or position('full workout' in v_text) > 0 then v_xp := 20;
  elsif position('quick' in v_text) > 0 then v_xp := 5;
  else v_xp := 10;
  end if;
  if v_xp > 20 then v_xp := 20; end if;
  if v_xp < 5 then v_xp := 5; end if;
  v_tier := case v_xp when 5 then 'small' when 20 then 'big' else 'medium' end;

  v_tz := public.quest_timezone(b.companion_id);
  v_today := public.quest_game_day(pg_catalog.now(), v_tz);
  v_day := coalesce(p_recorded_on, v_today);
  if v_day > v_today then raise exception 'Future date'; end if;
  if v_day < (v_today - 30) then raise exception 'Backdate too far'; end if;

  select * into existing from public.companion_activities where recorded_by = u and request_id = p_request;
  if found then
    if public.companion_title_key(existing.title) is distinct from public.companion_title_key(v_title)
      or existing.note is distinct from v_note then
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
    bond_id, subject_id, recorded_by, request_id, title, note, dedupe_key, xp_awarded, recorded_on)
    values (b.id, b.companion_id, u, p_request, v_title, v_note, v_key, v_xp, v_day)
    returning id into v_id;

  return jsonb_build_object(
    'activityId', v_id, 'already', false, 'xpAwarded', v_xp, 'tier', v_tier, 'day', v_day, 'voided', false);
end $$;
revoke all on function public.companion_log_activity_v2(uuid, text, text, text, date) from public, anon;
grant execute on function public.companion_log_activity_v2(uuid, text, text, text, date) to authenticated;
