-- Versioned companion activity log. TEST only.
-- Reverse with supabase/rollbacks/202611110005_companion_log_activity_v2_down.sql.
-- Original companion_log_activity(uuid, text, text) is unchanged.

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
  v_key text;
  existing public.companion_activities%rowtype;
  v_quest uuid;
  v_inst uuid;
  v_award jsonb;
  v_ledger uuid;
  v_id uuid;
  v_xp integer := 10;
  v_tz text;
begin
  if u is null then raise exception 'Sign-in required'; end if;
  if p_request is null then raise exception 'Invalid activity'; end if;
  select * into b from public.companion_bonds where status = 'active' and inviter_id = u for update;
  if not found or b.companion_id is null then raise exception 'Companion connection required'; end if;
  if v_title is null or char_length(v_title) not between 1 and 120 then raise exception 'Invalid title'; end if;
  if v_note is not null and char_length(v_note) > 500 then raise exception 'Invalid note'; end if;

  -- Server-authoritative tier. Client suggestion is clamped.
  if p_tier = 'small' then v_xp := 5;
  elsif p_tier = 'big' then v_xp := 20;
  else v_xp := 10;
  end if;

  v_tz := public.quest_timezone(b.companion_id);
  v_day := coalesce(p_recorded_on, public.quest_game_day(pg_catalog.now(), v_tz));
  -- 30-day window, 5 AM CT boundary handled by quest_game_day.
  if p_recorded_on is not null and p_recorded_on < (public.quest_game_day(pg_catalog.now(), v_tz) - 30) then
    raise exception 'Backdate too far';
  end if;

  select * into existing from public.companion_activities where recorded_by = u and request_id = p_request;
  if found then
    return jsonb_build_object('activityId', existing.id, 'already', true, 'xpAwarded', 0);
  end if;

  v_key := b.companion_id::text || ':' || public.companion_title_key(v_title) || ':' || v_day::text;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('companion-activity:' || v_key, 0));
  select * into existing from public.companion_activities
    where subject_id = b.companion_id and dedupe_key = v_key and voided_at is null;
  if found then
    return jsonb_build_object('activityId', existing.id, 'already', true, 'xpAwarded', 0);
  end if;

  insert into public.quests(owner_id, title, domain, cadence, scheduled_for, quest_type)
    values (b.companion_id, v_title, 'relationships', 'once', v_day, 'scheduled')
    returning id into v_quest;
  insert into public.quest_instances(owner_id, quest_id, due_date)
    values (b.companion_id, v_quest, v_day)
    returning id into v_inst;

  -- Award the clamped XP. Uses existing personal path then adjusts if needed.
  v_award := public._award_personal_quest_xp(b.companion_id, v_inst);
  select id into v_ledger from public.xp_ledger where instance_id = v_inst and owner_id = b.companion_id;
  if v_ledger is not null and v_xp <> 10 then
    update public.xp_ledger set amount = v_xp where id = v_ledger;
  end if;

  insert into public.companion_activities(
    bond_id, subject_id, recorded_by, request_id, title, note, dedupe_key, quest_id, instance_id, ledger_id)
    values (b.id, b.companion_id, u, p_request, v_title, v_note, v_key, v_quest, v_inst, v_ledger)
    returning id into v_id;

  return jsonb_build_object(
    'activityId', v_id, 'already', false, 'xpAwarded', v_xp, 'tier', coalesce(p_tier, 'medium'), 'day', v_day);
end $$;
revoke all on function public.companion_log_activity_v2(uuid, text, text, text, date) from public, anon;
grant execute on function public.companion_log_activity_v2(uuid, text, text, text, date) to authenticated;
