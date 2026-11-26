-- Cap the lights-out streak bonus. Forward only.
-- TEST project only: njqwwimzrsunheehnnnt. Do not apply to production.
--
-- LIGHTS_OUT_BASE_XP = 5
-- LIGHTS_OUT_STREAK_BONUS_XP = 1
-- LIGHTS_OUT_STREAK_BONUS_MAX_XP = 5
-- award = 5 + least(1 * prior nights, 5)
-- A night pays at most 10 XP, reached after 5 prior nights.
-- Existing health_lights_out rows are not updated.
--
-- Reverse with supabase/rollbacks/202611260030_lights_out_bonus_cap_down.sql,
-- which restores the previous uncapped function and does not touch rows.

create or replace function public.lights_out_xp(p_prior integer)
returns integer language sql immutable strict set search_path = ''
as $$ select 5 + least(1 * greatest(p_prior, 0), 5) $$;

revoke all on function public.lights_out_xp(integer) from public, anon, authenticated;
comment on function public.lights_out_xp(integer) is
  'LIGHTS_OUT_BASE_XP=5 plus least(LIGHTS_OUT_STREAK_BONUS_XP=1 * prior nights, LIGHTS_OUT_STREAK_BONUS_MAX_XP=5). Not quest_streak_xp. Existing rows are not rewritten.';
