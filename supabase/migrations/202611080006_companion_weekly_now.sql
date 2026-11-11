-- Companion one-shot weekly quests are on the board for their whole week.
-- The random Monday 05:00–Thursday noon reveal stays for Connor's own weekly quests.
-- Reverse with supabase/rollbacks/202611080006_companion_weekly_now_down.sql.

create or replace function public._check_weekly_window(p_owner uuid, p_quest uuid, p_due date)
returns void language plpgsql stable set search_path = ''
as $$
declare v_tz text := public.quest_timezone(p_owner); v_week date; v_one_shot boolean;
begin
  v_week := public.quest_week_start(public.quest_game_day(pg_catalog.now(), v_tz));
  if p_due <> v_week then
    raise exception 'Weekly quests can only be completed during their own week';
  end if;
  select q.companion_one_shot into v_one_shot
    from public.quests q
    where q.id = p_quest and q.owner_id = p_owner;
  if coalesce(v_one_shot, false) then
    return;
  end if;
  if pg_catalog.now() < public.quest_weekly_appears_at(p_owner, p_quest, p_due, v_tz) then
    raise exception 'This weekly quest is not on your board yet';
  end if;
end $$;
revoke all on function public._check_weekly_window(uuid, uuid, date) from public, anon, authenticated, service_role;
