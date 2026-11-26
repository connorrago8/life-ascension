-- Health and Finance tracks. Additive and reversible.
-- TEST project only: njqwwimzrsunheehnnnt. Do not apply to production.
--
-- Lights-out XP is a separate config from quest_streak_xp:
--   LIGHTS_OUT_BASE_XP = 5
--   LIGHTS_OUT_STREAK_BONUS_XP = 1 per prior consecutive night
--   award = 5 + 1 × prior nights
-- A lights-out row is not an xp_ledger quest completion, so it does not take
-- the flat 10 XP first quest of the game day. Lifetime XP adds the lights-out
-- total on top of the existing ledger sum.
--
-- Finance stores a decision enum only. There are no amount, balance, or account columns.
-- Payday credit goes through the existing set_quest_instance_status_v2 award.
-- Scheduling a follow-up does not complete it and does not award XP.
--
-- Reverse with supabase/rollbacks/202611260010_health_finance_down.sql.
-- Do not run the down file once real lights-out or payday rows exist: it drops
-- those new tables. It does not delete quests, xp_ledger, streaks, or gear.

create table public.health_lights_out (
  owner_id uuid not null references auth.users(id) on delete cascade,
  game_day date not null,
  request_id uuid not null,
  prior_streak integer not null check (prior_streak >= 0),
  xp_awarded integer not null check (xp_awarded >= 5),
  created_at timestamptz not null default pg_catalog.now(),
  primary key (owner_id, game_day),
  unique (owner_id, request_id)
);

create table public.health_meals (
  owner_id uuid not null references auth.users(id) on delete cascade,
  game_day date not null,
  balanced boolean,
  protein boolean,
  produce boolean,
  delivery boolean,
  updated_at timestamptz not null default pg_catalog.now(),
  primary key (owner_id, game_day),
  constraint health_meals_not_blank check (pg_catalog.num_nonnulls(balanced, protein, produce, delivery) > 0)
);

create table public.health_notes (
  owner_id uuid not null references auth.users(id) on delete cascade,
  game_day date not null,
  sleep_note text,
  recovery_note text,
  updated_at timestamptz not null default pg_catalog.now(),
  primary key (owner_id, game_day),
  constraint health_notes_length check (
    (sleep_note is null or char_length(sleep_note) <= 500)
    and (recovery_note is null or char_length(recovery_note) <= 500)
  ),
  constraint health_notes_not_blank check (
    nullif(pg_catalog.btrim(coalesce(sleep_note, '')), '') is not null
    or nullif(pg_catalog.btrim(coalesce(recovery_note, '')), '') is not null
  )
);

create table public.finance_payday_checks (
  owner_id uuid not null references auth.users(id) on delete cascade,
  payday date not null,
  decision text not null check (decision in ('minimum_only', 'review_needed', 'extra_payment')),
  request_id uuid not null,
  quest_id uuid,
  instance_id uuid,
  created_at timestamptz not null default pg_catalog.now(),
  primary key (owner_id, payday),
  unique (owner_id, request_id)
);

create table public.finance_followups (
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('pay_down_card', 'cash_buffer')),
  quest_id uuid,
  created_at timestamptz not null default pg_catalog.now(),
  primary key (owner_id, kind)
);

alter table public.health_lights_out enable row level security;
alter table public.health_meals enable row level security;
alter table public.health_notes enable row level security;
alter table public.finance_payday_checks enable row level security;
alter table public.finance_followups enable row level security;
alter table public.health_lights_out force row level security;
alter table public.health_meals force row level security;
alter table public.health_notes force row level security;
alter table public.finance_payday_checks force row level security;
alter table public.finance_followups force row level security;

revoke all on public.health_lights_out, public.health_meals, public.health_notes,
  public.finance_payday_checks, public.finance_followups from public, anon, authenticated;
grant select on public.health_lights_out, public.health_meals, public.health_notes,
  public.finance_payday_checks, public.finance_followups to authenticated;

create policy health_lights_out_owner_read on public.health_lights_out
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy health_meals_owner_read on public.health_meals
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy health_notes_owner_read on public.health_notes
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy finance_payday_owner_read on public.finance_payday_checks
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy finance_followups_owner_read on public.finance_followups
  for select to authenticated using ((select auth.uid()) = owner_id);

create or replace function public.lights_out_xp(p_prior integer)
returns integer language sql immutable strict set search_path = ''
as $$ select 5 + 1 * greatest(p_prior, 0) $$;
revoke all on function public.lights_out_xp(integer) from public, anon, authenticated;
comment on function public.lights_out_xp(integer) is
  'LIGHTS_OUT_BASE_XP=5 plus LIGHTS_OUT_STREAK_BONUS_XP=1 per prior consecutive night. Not quest_streak_xp.';

create or replace function public.finance_payday_allowed(p_day date)
returns boolean language sql immutable strict set search_path = ''
as $$
  select p_day >= date '2026-12-03'
    and p_day <= date '2027-05-20'
    and ((p_day - date '2026-12-03') % 14 = 0)
$$;
revoke all on function public.finance_payday_allowed(date) from public, anon, authenticated;

create or replace function public.record_lights_out(p_game_day date, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_today date;
  v_existing public.health_lights_out%rowtype;
  v_prior integer := 0;
  v_cursor date;
  v_xp integer;
  v_week integer;
begin
  if v_owner is null then raise exception 'Sign-in required'; end if;
  if p_game_day is null or p_request_id is null then raise exception 'Invalid lights-out night'; end if;
  v_today := public.quest_today();
  if p_game_day > v_today or p_game_day < v_today - 2 then
    raise exception 'Choose an eligible lights-out night';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('lights-out:' || v_owner::text, 0));
  select * into v_existing from public.health_lights_out
    where owner_id = v_owner and (game_day = p_game_day or request_id = p_request_id)
    limit 1;
  if found then
    return jsonb_build_object('already', true, 'xp_awarded', 0, 'game_day', v_existing.game_day, 'stored_xp', v_existing.xp_awarded);
  end if;
  v_cursor := p_game_day - 1;
  while exists (select 1 from public.health_lights_out where owner_id = v_owner and game_day = v_cursor) loop
    v_prior := v_prior + 1;
    v_cursor := v_cursor - 1;
  end loop;
  v_xp := public.lights_out_xp(v_prior);
  insert into public.health_lights_out (owner_id, game_day, request_id, prior_streak, xp_awarded)
  values (v_owner, p_game_day, p_request_id, v_prior, v_xp);
  select count(*) into v_week from public.health_lights_out
    where owner_id = v_owner and game_day between v_today - 6 and v_today;
  return jsonb_build_object(
    'already', false, 'xp_awarded', v_xp, 'game_day', p_game_day,
    'prior_streak', v_prior, 'seven_night_count', v_week);
exception when unique_violation then
  select * into v_existing from public.health_lights_out
    where owner_id = v_owner and (game_day = p_game_day or request_id = p_request_id)
    limit 1;
  return jsonb_build_object('already', true, 'xp_awarded', 0, 'game_day', coalesce(v_existing.game_day, p_game_day), 'stored_xp', coalesce(v_existing.xp_awarded, 0));
end $$;
revoke all on function public.record_lights_out(date, uuid) from public, anon;
grant execute on function public.record_lights_out(date, uuid) to authenticated;

create or replace function public.save_health_meal(
  p_game_day date, p_balanced boolean, p_protein boolean, p_produce boolean, p_delivery boolean
) returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_owner uuid := auth.uid(); v_today date;
begin
  if v_owner is null then raise exception 'Sign-in required'; end if;
  v_today := public.quest_today();
  if p_game_day is null or p_game_day > v_today or p_game_day < v_today - 2 then
    raise exception 'Choose an eligible health day';
  end if;
  if p_balanced is null and p_protein is null and p_produce is null and p_delivery is null then
    raise exception 'Blank meal stays unlogged';
  end if;
  insert into public.health_meals (owner_id, game_day, balanced, protein, produce, delivery)
  values (v_owner, p_game_day, p_balanced, p_protein, p_produce, p_delivery)
  on conflict (owner_id, game_day) do update set
    balanced = excluded.balanced, protein = excluded.protein, produce = excluded.produce,
    delivery = excluded.delivery, updated_at = pg_catalog.now();
  return jsonb_build_object('xp_awarded', 0, 'game_day', p_game_day);
end $$;
revoke all on function public.save_health_meal(date, boolean, boolean, boolean, boolean) from public, anon;
grant execute on function public.save_health_meal(date, boolean, boolean, boolean, boolean) to authenticated;

create or replace function public.save_health_notes(p_game_day date, p_sleep text, p_recovery text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_owner uuid := auth.uid(); v_today date; v_sleep text; v_recovery text;
begin
  if v_owner is null then raise exception 'Sign-in required'; end if;
  v_today := public.quest_today();
  if p_game_day is null or p_game_day > v_today or p_game_day < v_today - 2 then
    raise exception 'Choose an eligible health day';
  end if;
  v_sleep := nullif(pg_catalog.btrim(coalesce(p_sleep, '')), '');
  v_recovery := nullif(pg_catalog.btrim(coalesce(p_recovery, '')), '');
  if v_sleep is null and v_recovery is null then raise exception 'Blank notes stay unlogged'; end if;
  if char_length(coalesce(v_sleep, '')) > 500 or char_length(coalesce(v_recovery, '')) > 500 then
    raise exception 'Notes are too long';
  end if;
  insert into public.health_notes (owner_id, game_day, sleep_note, recovery_note)
  values (v_owner, p_game_day, v_sleep, v_recovery)
  on conflict (owner_id, game_day) do update set
    sleep_note = excluded.sleep_note, recovery_note = excluded.recovery_note, updated_at = pg_catalog.now();
  return jsonb_build_object('xp_awarded', 0, 'game_day', p_game_day);
end $$;
revoke all on function public.save_health_notes(date, text, text) from public, anon;
grant execute on function public.save_health_notes(date, text, text) to authenticated;

create or replace function public.complete_payday_check(p_payday date, p_decision text, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_today date;
  v_existing public.finance_payday_checks%rowtype;
  v_quest uuid;
  v_instance uuid;
  v_award jsonb;
  v_xp integer := 0;
begin
  if v_owner is null then raise exception 'Sign-in required'; end if;
  if p_request_id is null or p_decision is null
     or p_decision not in ('minimum_only', 'review_needed', 'extra_payment') then
    raise exception 'Invalid payday check';
  end if;
  if not public.finance_payday_allowed(p_payday) then raise exception 'Select a scheduled payday'; end if;
  v_today := public.quest_today();
  if p_payday > v_today then raise exception 'This payday check is not open yet'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('payday:' || v_owner::text || ':' || p_payday::text, 0));
  select * into v_existing from public.finance_payday_checks
    where owner_id = v_owner and (payday = p_payday or request_id = p_request_id)
    limit 1;
  if found then
    return jsonb_build_object('already', true, 'xp_awarded', 0, 'payday', v_existing.payday, 'decision', v_existing.decision);
  end if;
  insert into public.quests (owner_id, title, domain, cadence, scheduled_for, quest_type)
  values (v_owner, 'Complete my payday money check', 'finance', 'once', p_payday, 'scheduled')
  returning id into v_quest;
  insert into public.quest_instances (owner_id, quest_id, due_date)
  values (v_owner, v_quest, p_payday)
  returning id into v_instance;
  v_award := public.set_quest_instance_status_v2(v_instance, 'complete');
  v_xp := coalesce((v_award->>'xp_awarded')::integer, 0);
  insert into public.finance_payday_checks (owner_id, payday, decision, request_id, quest_id, instance_id)
  values (v_owner, p_payday, p_decision, p_request_id, v_quest, v_instance);
  return jsonb_build_object(
    'already', false, 'xp_awarded', v_xp, 'payday', p_payday, 'decision', p_decision, 'quest_id', v_quest);
exception when unique_violation then
  select * into v_existing from public.finance_payday_checks
    where owner_id = v_owner and (payday = p_payday or request_id = p_request_id)
    limit 1;
  return jsonb_build_object('already', true, 'xp_awarded', 0, 'payday', coalesce(v_existing.payday, p_payday), 'decision', v_existing.decision);
end $$;
revoke all on function public.complete_payday_check(date, text, uuid) from public, anon;
grant execute on function public.complete_payday_check(date, text, uuid) to authenticated;

create or replace function public.accept_finance_followup(p_kind text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_title text;
  v_existing public.finance_followups%rowtype;
  v_quest uuid;
begin
  if v_owner is null then raise exception 'Sign-in required'; end if;
  v_title := case p_kind
    when 'pay_down_card' then 'Pay Down a Card'
    when 'cash_buffer' then 'Check the Cash Buffer'
    else null end;
  if v_title is null then raise exception 'Unknown follow-up'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('finance-followup:' || v_owner::text || ':' || p_kind, 0));
  select * into v_existing from public.finance_followups where owner_id = v_owner and kind = p_kind;
  if found then
    return jsonb_build_object('already', true, 'xp_awarded', 0, 'quest_id', v_existing.quest_id);
  end if;
  v_quest := public.create_scheduled_quest(v_title, 'finance', 'once', public.quest_today(), 'scheduled');
  insert into public.finance_followups (owner_id, kind, quest_id) values (v_owner, p_kind, v_quest);
  return jsonb_build_object('already', false, 'xp_awarded', 0, 'quest_id', v_quest);
end $$;
revoke all on function public.accept_finance_followup(text) from public, anon;
grant execute on function public.accept_finance_followup(text) to authenticated;

create or replace function public.get_lifetime_xp()
returns bigint language sql stable set search_path = ''
as $$
  select (
    coalesce((select sum(amount) from public.xp_ledger where owner_id = (select auth.uid())), 0)
    + coalesce((select sum(amount) from public.xp_ledger_adjustments where owner_id = (select auth.uid())), 0)
    + coalesce((select sum(xp_awarded) from public.health_lights_out where owner_id = (select auth.uid())), 0)
  )::bigint
$$;
revoke all on function public.get_lifetime_xp() from public, anon;
grant execute on function public.get_lifetime_xp() to authenticated;

notify pgrst, 'reload schema';
