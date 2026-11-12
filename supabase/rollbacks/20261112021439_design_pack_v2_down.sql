-- Reverse 20261112021439_design_pack_v2.sql. Does not remove Izzy XP already paid.
begin;

drop function if exists public.couple_choose_date_idea(integer);
drop table if exists public.date_night_ideas;

alter table public.couple_quests drop constraint if exists couple_quests_cost_tag_check;
alter table public.couple_quests drop constraint if exists couple_quests_duration_tag_check;
alter table public.couple_quests drop constraint if exists couple_quests_setting_tag_check;
alter table public.couple_quests drop column if exists cost_tag;
alter table public.couple_quests drop column if exists duration_tag;
alter table public.couple_quests drop column if exists setting_tag;
alter table public.couple_xp_config drop column if exists recap_schedule;
alter table public.couple_xp_config drop column if exists shield_month_reset;

notify pgrst, 'reload schema';
commit;
