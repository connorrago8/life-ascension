-- Restores the uncapped lights-out function from 202611260010.
-- Does not update or delete health_lights_out rows.

create or replace function public.lights_out_xp(p_prior integer)
returns integer language sql immutable strict set search_path = ''
as $$ select 5 + 1 * greatest(p_prior, 0) $$;

revoke all on function public.lights_out_xp(integer) from public, anon, authenticated;
comment on function public.lights_out_xp(integer) is
  'LIGHTS_OUT_BASE_XP=5 plus LIGHTS_OUT_STREAK_BONUS_XP=1 per prior consecutive night. Not quest_streak_xp.';
