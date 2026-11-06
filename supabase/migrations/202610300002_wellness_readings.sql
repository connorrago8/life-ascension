-- Wellness readings from an Apple Health Shortcut: one row per user per day (sleep hours, steps).
-- TEST-ONLY candidate. Additive: a new table and new functions only; no existing table, policy,
-- grant or function is altered. Reverse with supabase/rollbacks/202610300002_wellness_readings_down.sql.
--
-- Security:
--   * RLS: a signed-in user can SELECT only their own rows. No client INSERT/UPDATE/DELETE.
--   * Writes go through record_wellness_reading (auth.uid()) or, for personal API keys,
--     record_wellness_reading_as_user, which is service_role only and pins auth.uid() with
--     public._bind_service_role_user (same pattern as the quest *_as_user wrappers).
--   * Ranges are enforced here as well as in POST /api/wellness: sleep 0-24 h, steps 0-200000,
--     date within the last 30 days through tomorrow (America/Chicago).
--   * Readings never award XP and never touch quests, the Crypt or the XP ledger.

create table public.wellness_readings (
  user_id uuid not null references auth.users(id) on delete cascade,
  reading_date date not null,
  sleep_hours numeric(4,2) check (sleep_hours between 0 and 24),
  steps integer check (steps between 0 and 200000),
  source text not null default 'apple_health_shortcut'
    check (source ~ '^[a-z0-9_]{1,40}$'),
  updated_at timestamptz not null default now(),
  constraint wellness_readings_user_date_key unique (user_id, reading_date),
  constraint wellness_readings_has_value check (sleep_hours is not null or steps is not null)
);

alter table public.wellness_readings enable row level security;
create policy wellness_readings_read_own on public.wellness_readings
  for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.wellness_readings from public, anon, authenticated;
grant select on public.wellness_readings to authenticated;
grant select, insert, update, delete on public.wellness_readings to service_role;

create or replace function public.record_wellness_reading(
  p_date date,
  p_sleep_hours numeric,
  p_steps integer,
  p_source text default 'apple_health_shortcut'
)
returns table (reading_date date, sleep_hours numeric, steps integer, source text, updated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user uuid := auth.uid();
  v_today date := (pg_catalog.now() at time zone 'America/Chicago')::date;
  v_source text := coalesce(nullif(p_source, ''), 'apple_health_shortcut');
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_date is null or p_date < v_today - 30 or p_date > v_today + 1 then
    raise exception 'Invalid wellness date' using errcode = '22023';
  end if;
  if p_sleep_hours is null and p_steps is null then
    raise exception 'Wellness reading needs sleep_hours or steps' using errcode = '22023';
  end if;
  if p_sleep_hours is not null and (p_sleep_hours < 0 or p_sleep_hours > 24) then
    raise exception 'Invalid sleep_hours' using errcode = '22023';
  end if;
  if p_steps is not null and (p_steps < 0 or p_steps > 200000) then
    raise exception 'Invalid steps' using errcode = '22023';
  end if;
  if v_source !~ '^[a-z0-9_]{1,40}$' then
    raise exception 'Invalid source' using errcode = '22023';
  end if;

  -- Upsert by (user, date). A value left out of a later post keeps the earlier one.
  return query
  insert into public.wellness_readings as w (user_id, reading_date, sleep_hours, steps, source, updated_at)
  values (v_user, p_date, round(p_sleep_hours, 2), p_steps, v_source, pg_catalog.now())
  on conflict on constraint wellness_readings_user_date_key do update
    set sleep_hours = coalesce(excluded.sleep_hours, w.sleep_hours),
        steps = coalesce(excluded.steps, w.steps),
        source = excluded.source,
        updated_at = pg_catalog.now()
  returning w.reading_date, w.sleep_hours, w.steps, w.source, w.updated_at;
end;
$$;

create or replace function public.record_wellness_reading_as_user(
  p_user_id uuid,
  p_date date,
  p_sleep_hours numeric,
  p_steps integer,
  p_source text default 'apple_health_shortcut'
)
returns table (reading_date date, sleep_hours numeric, steps integer, source text, updated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public._bind_service_role_user(p_user_id);
  return query select * from public.record_wellness_reading(p_date, p_sleep_hours, p_steps, p_source);
end;
$$;

revoke all on function public.record_wellness_reading(date, numeric, integer, text) from public, anon;
grant execute on function public.record_wellness_reading(date, numeric, integer, text) to authenticated, service_role;
revoke all on function public.record_wellness_reading_as_user(uuid, date, numeric, integer, text) from public, anon, authenticated;
grant execute on function public.record_wellness_reading_as_user(uuid, date, numeric, integer, text) to service_role;
