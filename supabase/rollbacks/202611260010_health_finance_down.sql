-- Reverses 202611260010_health_finance.sql.
-- Drops only the new Health and Finance tables. It does not delete quests,
-- xp_ledger rows, streaks, unlocks, gear, or quest history.
-- Do not run this once real lights-out nights or payday checks exist: those
-- new rows, including lights-out XP, would be removed.

create or replace function public.get_lifetime_xp()
returns bigint language sql stable set search_path = ''
as $$
  select (
    coalesce((select sum(amount) from public.xp_ledger where owner_id = (select auth.uid())), 0)
    + coalesce((select sum(amount) from public.xp_ledger_adjustments where owner_id = (select auth.uid())), 0)
  )::bigint
$$;
revoke all on function public.get_lifetime_xp() from public, anon;
grant execute on function public.get_lifetime_xp() to authenticated;

drop function if exists public.accept_finance_followup(text);
drop function if exists public.complete_payday_check(date, text, uuid);
drop function if exists public.save_health_notes(date, text, text);
drop function if exists public.save_health_meal(date, boolean, boolean, boolean, boolean);
drop function if exists public.record_lights_out(date, uuid);
drop function if exists public.finance_payday_allowed(date);
drop function if exists public.lights_out_xp(integer);

drop table if exists public.finance_followups;
drop table if exists public.finance_payday_checks;
drop table if exists public.health_notes;
drop table if exists public.health_meals;
drop table if exists public.health_lights_out;

notify pgrst, 'reload schema';
