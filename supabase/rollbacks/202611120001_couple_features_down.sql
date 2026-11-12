-- Reverse 202611120001_couple_features.sql.
-- Couple-quest personal awards are removed with the quests they created.
-- Other xp_ledger rows are left as they were. Shield rows go away with the table.

begin;

create or replace function public.quest_streak_fire(p_owner uuid, p_today date, p_tz text)
returns integer language plpgsql stable set search_path = ''
as $$
declare d date := p_today - 1; n integer := 0;
begin
  while public.quest_has_completion_on(p_owner, d, p_tz) loop
    n := n + 1;
    d := d - 1;
  end loop;
  return n;
end $$;
revoke all on function public.quest_streak_fire(uuid, date, text) from public, anon, authenticated;

drop function if exists public.couple_weekly_recap();
drop function if exists public._couple_weekly_recap_at(timestamptz);
drop function if exists public._companion_streak_at(uuid, uuid, date, text);
drop function if exists public.couple_board();
drop function if exists public.couple_quest_mark(uuid);
drop function if exists public.couple_step_done(uuid);
drop function if exists public.couple_create_date_night(text, text[], integer, integer, integer);
drop function if exists public.couple_quest_create(text, text, text);
drop function if exists public.couple_add_quest_pack();
drop function if exists public._couple_active_bond();
drop function if exists public._couple_period(text, date);
drop function if exists public._couple_plain(text, integer);
drop function if exists public.get_streak_shield();
drop function if exists public._streak_shield_status(uuid, timestamptz);
drop function if exists public.streak_shield_month(timestamptz);
drop function if exists public._streak_shield_sync(uuid, date, text);
drop function if exists public._quest_streak_fire_at(uuid, date, text);
drop function if exists public.couple_companion_xp();
drop function if exists public.profile_level(bigint);
drop function if exists public.xp_to_reach_level(integer);
drop function if exists public.couple_title_key(text);

delete from public.quests q
using public.couple_quest_awards a
where q.id = a.personal_quest_id;

drop table if exists public.couple_quest_awards;
drop table if exists public.couple_quest_marks;
drop table if exists public.couple_quest_steps;
drop table if exists public.couple_quests;
drop table if exists public.companion_xp_ledger;
drop table if exists public.streak_shields;
drop table if exists public.couple_xp_config;

notify pgrst, 'reload schema';
commit;
