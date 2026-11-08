-- Reverse 202611080006. Weekly quests wait for their seeded reveal again.
begin;

create or replace function public._check_weekly_window(p_owner uuid, p_quest uuid, p_due date)
returns void language plpgsql stable set search_path = ''
as $$
declare v_tz text := public.quest_timezone(p_owner); v_week date;
begin
  v_week := public.quest_week_start(public.quest_game_day(pg_catalog.now(), v_tz));
  if p_due <> v_week then
    raise exception 'Weekly quests can only be completed during their own week';
  end if;
  if pg_catalog.now() < public.quest_weekly_appears_at(p_owner, p_quest, p_due, v_tz) then
    raise exception 'This weekly quest is not on your board yet';
  end if;
end $$;
revoke all on function public._check_weekly_window(uuid, uuid, date) from public, anon, authenticated, service_role;

commit;
