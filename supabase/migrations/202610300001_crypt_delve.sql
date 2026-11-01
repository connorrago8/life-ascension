-- Forgotten Crypt delve: attribute allocation, kept loot, floor checkpoints, capped Crypt XP.
-- TEST-ONLY candidate. Additive: new tables/functions only; no existing table, policy,
-- grant or function is altered. Reverse with supabase/rollbacks/202610300001_crypt_delve_down.sql.
--
-- Founder rules enforced here, server-side:
--   * Real quests stay exactly +1 XP each; xp_ledger and get_lifetime_xp are untouched.
--   * Crypt XP is tracked in tenths per user per America/Chicago day and capped at
--     1 tenth per real quest completed that same day (i.e. <= 10% of that day's real XP).
--   * Whole Crypt XP is only ever derived server-side: floor(sum(tenths) / 10).
--   * Attribute points are capped by the level computed from xp_ledger, not by the client.
--   * Clients get SELECT on their own rows only; every write goes through a checked function.

create table public.crypt_hero (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  strength smallint not null default 0 check (strength between 0 and 60),
  agility smallint not null default 0 check (agility between 0 and 60),
  intelligence smallint not null default 0 check (intelligence between 0 and 60),
  endurance smallint not null default 0 check (endurance between 0 and 60),
  luck smallint not null default 0 check (luck between 0 and 60),
  updated_at timestamptz not null default now()
);

create table public.crypt_loot (
  owner_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid not null,
  drop_index smallint not null check (drop_index between 0 and 39),
  item_id text not null check (item_id in (
    'rusty-shortsword','bone-cleaver','ember-blade','warden-glaive',
    'leather-cap','scholar-circlet','sentinel-helm','hollow-crown',
    'tattered-gambeson','grave-mail','sentinel-plate','warden-mantle',
    'plank-buckler','iron-heater','moth-ward','warden-aegis')),
  found_at timestamptz not null default now(),
  primary key (owner_id, run_id, drop_index)
);
create index crypt_loot_owner_found_idx on public.crypt_loot(owner_id, found_at);

create table public.crypt_progress (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  deepest_floor smallint not null default 0 check (deepest_floor between 0 and 5),
  updated_at timestamptz not null default now()
);

create table public.crypt_floor_clears (
  owner_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid not null,
  floor smallint not null check (floor between 1 and 5),
  cleared_at timestamptz not null default now(),
  primary key (owner_id, run_id, floor)
);

create table public.crypt_xp_daily (
  owner_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  tenths integer not null default 0 check (tenths >= 0),
  primary key (owner_id, day)
);

alter table public.crypt_hero enable row level security;
alter table public.crypt_loot enable row level security;
alter table public.crypt_progress enable row level security;
alter table public.crypt_floor_clears enable row level security;
alter table public.crypt_xp_daily enable row level security;
create policy crypt_hero_read on public.crypt_hero for select to authenticated using (owner_id = (select auth.uid()));
create policy crypt_loot_read on public.crypt_loot for select to authenticated using (owner_id = (select auth.uid()));
create policy crypt_progress_read on public.crypt_progress for select to authenticated using (owner_id = (select auth.uid()));
create policy crypt_floor_clears_read on public.crypt_floor_clears for select to authenticated using (owner_id = (select auth.uid()));
create policy crypt_xp_daily_read on public.crypt_xp_daily for select to authenticated using (owner_id = (select auth.uid()));
revoke all on public.crypt_hero, public.crypt_loot, public.crypt_progress, public.crypt_floor_clears, public.crypt_xp_daily
  from public, anon, authenticated;
grant select on public.crypt_hero, public.crypt_loot, public.crypt_progress, public.crypt_floor_clears, public.crypt_xp_daily
  to authenticated;

-- Level from verified XP, same curve as lib/level.ts (level n -> n+1 costs 5 * (n + 1)).
create function public.crypt_level_for_owner(p_owner uuid)
returns integer language plpgsql stable security definer set search_path = '' as $$
declare v_xp bigint; v_level integer := 1;
begin
  select coalesce(sum(amount), 0) into v_xp from public.xp_ledger where owner_id = p_owner;
  while v_level < 1000 and (5 * ((v_level + 1) * (v_level + 2) - 2)) / 2 <= v_xp loop
    v_level := v_level + 1;
  end loop;
  return v_level;
end;
$$;
revoke all on function public.crypt_level_for_owner(uuid) from public, anon, authenticated;

-- Today in the Founder's day boundary.
create function public.crypt_today()
returns date language sql stable set search_path = '' as $$
  select (pg_catalog.now() at time zone 'America/Chicago')::date;
$$;
revoke all on function public.crypt_today() from public, anon, authenticated;

create function public.set_crypt_attributes(p_strength integer, p_agility integer, p_intelligence integer, p_endurance integer, p_luck integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_owner uuid := auth.uid(); v_points integer;
begin
  if v_owner is null then raise exception 'Authentication required'; end if;
  if p_strength is null or p_agility is null or p_intelligence is null or p_endurance is null or p_luck is null
     or least(p_strength, p_agility, p_intelligence, p_endurance, p_luck) < 0
     or greatest(p_strength, p_agility, p_intelligence, p_endurance, p_luck) > 60 then
    raise exception 'Invalid attribute allocation';
  end if;
  v_points := 7 + 2 * public.crypt_level_for_owner(v_owner);
  if p_strength + p_agility + p_intelligence + p_endurance + p_luck > v_points then
    raise exception 'Not enough attribute points';
  end if;
  insert into public.crypt_hero(owner_id, strength, agility, intelligence, endurance, luck)
    values (v_owner, p_strength, p_agility, p_intelligence, p_endurance, p_luck)
    on conflict (owner_id) do update set strength = excluded.strength, agility = excluded.agility,
      intelligence = excluded.intelligence, endurance = excluded.endurance, luck = excluded.luck, updated_at = now();
  return pg_catalog.jsonb_build_object('strength', p_strength, 'agility', p_agility, 'intelligence', p_intelligence,
    'endurance', p_endurance, 'luck', p_luck, 'points', v_points);
end;
$$;

-- Keep gear as it drops (so a lost or abandoned run still keeps it). Idempotent per drop.
-- Server limits: allowlisted ids, 40 drops per run, 60 kept drops per Chicago day.
create function public.claim_crypt_loot(p_run_id uuid, p_drop_index integer, p_item_id text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_owner uuid := auth.uid(); v_today_count integer; v_rows integer;
begin
  if v_owner is null then raise exception 'Authentication required'; end if;
  if p_run_id is null or p_drop_index is null or p_drop_index < 0 or p_drop_index > 39 or p_item_id is null then
    raise exception 'Invalid loot claim';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_owner::text, 20261030));
  select pg_catalog.count(*) into v_today_count from public.crypt_loot
    where owner_id = v_owner and (found_at at time zone 'America/Chicago')::date = public.crypt_today();
  if v_today_count >= 60 then raise exception 'Daily Crypt loot limit reached'; end if;
  insert into public.crypt_loot(owner_id, run_id, drop_index, item_id)
    values (v_owner, p_run_id, p_drop_index, p_item_id) on conflict do nothing;
  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;

-- Floor checkpoint + capped Crypt XP. A floor clear asks for `floor` tenths; the server
-- grants at most what is left of today's cap (1 tenth per real quest completed today).
create function public.record_crypt_floor_clear(p_run_id uuid, p_floor integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := auth.uid(); v_today date; v_cap integer; v_used integer; v_grant integer := 0; v_rows integer;
  v_deepest integer;
begin
  if v_owner is null then raise exception 'Authentication required'; end if;
  if p_run_id is null or p_floor is null or p_floor < 1 or p_floor > 5 then raise exception 'Invalid floor'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_owner::text, 20261030));
  v_today := public.crypt_today();
  insert into public.crypt_floor_clears(owner_id, run_id, floor) values (v_owner, p_run_id, p_floor)
    on conflict do nothing;
  get diagnostics v_rows = row_count;
  insert into public.crypt_progress(owner_id, deepest_floor) values (v_owner, p_floor)
    on conflict (owner_id) do update set deepest_floor = greatest(public.crypt_progress.deepest_floor, excluded.deepest_floor),
      updated_at = now();
  select pg_catalog.count(*)::integer into v_cap from public.xp_ledger
    where owner_id = v_owner and (awarded_at at time zone 'America/Chicago')::date = v_today;
  select coalesce((select tenths from public.crypt_xp_daily where owner_id = v_owner and day = v_today), 0) into v_used;
  if v_rows > 0 then
    v_grant := greatest(0, least(p_floor, v_cap - v_used));
    if v_grant > 0 then
      insert into public.crypt_xp_daily(owner_id, day, tenths) values (v_owner, v_today, v_grant)
        on conflict (owner_id, day) do update set tenths = public.crypt_xp_daily.tenths + excluded.tenths;
      v_used := v_used + v_grant;
    end if;
  end if;
  select deepest_floor into v_deepest from public.crypt_progress where owner_id = v_owner;
  return pg_catalog.jsonb_build_object('firstClear', v_rows > 0, 'tenthsAwarded', v_grant,
    'tenthsToday', v_used, 'capToday', v_cap, 'deepestFloor', v_deepest,
    'cryptXp', (select coalesce(sum(tenths), 0) / 10 from public.crypt_xp_daily where owner_id = v_owner));
end;
$$;

-- Whole Crypt XP, derived only here. Never client-supplied.
create function public.get_crypt_xp()
returns integer language sql stable security definer set search_path = '' as $$
  select (coalesce(sum(tenths), 0) / 10)::integer from public.crypt_xp_daily where owner_id = (select auth.uid());
$$;

create function public.get_crypt_profile()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_owner uuid := auth.uid(); v_today date := public.crypt_today();
begin
  if v_owner is null then raise exception 'Authentication required'; end if;
  return pg_catalog.jsonb_build_object(
    'attributes', coalesce((select pg_catalog.jsonb_build_object('strength', strength, 'agility', agility,
        'intelligence', intelligence, 'endurance', endurance, 'luck', luck) from public.crypt_hero where owner_id = v_owner), '{}'::jsonb),
    'vaultItemIds', coalesce((select pg_catalog.jsonb_agg(distinct item_id) from public.crypt_loot where owner_id = v_owner), '[]'::jsonb),
    'deepestFloor', coalesce((select deepest_floor from public.crypt_progress where owner_id = v_owner), 0),
    'tenthsToday', coalesce((select tenths from public.crypt_xp_daily where owner_id = v_owner and day = v_today), 0),
    'capToday', (select pg_catalog.count(*) from public.xp_ledger
      where owner_id = v_owner and (awarded_at at time zone 'America/Chicago')::date = v_today),
    'cryptXp', (select (coalesce(sum(tenths), 0) / 10)::integer from public.crypt_xp_daily where owner_id = v_owner));
end;
$$;

revoke all on function public.set_crypt_attributes(integer, integer, integer, integer, integer), public.claim_crypt_loot(uuid, integer, text),
  public.record_crypt_floor_clear(uuid, integer), public.get_crypt_xp(), public.get_crypt_profile() from public, anon;
grant execute on function public.set_crypt_attributes(integer, integer, integer, integer, integer), public.claim_crypt_loot(uuid, integer, text),
  public.record_crypt_floor_clear(uuid, integer), public.get_crypt_xp(), public.get_crypt_profile() to authenticated;
