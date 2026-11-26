-- Apple Health ingest for Lights Out and owner nutrition. Forward only.
-- TEST project only: njqwwimzrsunheehnnnt. Do not apply to production ugcvhmrriazbbymjxvch.
--
-- The ingest token is stored as a SHA-256 hash. Plaintext is returned once by
-- issue_health_ingest_token and is not written to a column.
--
-- Sleep uses public.record_lights_out, so the 5 XP cap and the exactly-once
-- night rules stay in that function. A duplicate sleep request id adds 0 XP.
--
-- Nutrition is a separate 0 XP shadow import: energy and three macros only.
-- Null does not erase a stored number. A repeated request id is rejected.
-- Nothing here is granted to Izzy, badges, profile export, or MCP.
--
-- Reverse with supabase/rollbacks/202611260210_apple_health_sleep_down.sql.
-- The down file drops only these new objects. It does not delete health_meals,
-- health_lights_out, quests, or xp_ledger.

create table public.health_ingest_tokens (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  token_prefix text not null check (token_prefix ~ '^la_sleep_[A-Za-z0-9_-]{8}$'),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default pg_catalog.now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create unique index health_ingest_tokens_one_active
  on public.health_ingest_tokens (owner_id)
  where revoked_at is null;

comment on table public.health_ingest_tokens is
  'Per-user Apple Health ingest token. token_hash is SHA-256 hex. Plaintext is never stored.';

create table public.health_ingest_hits (
  owner_id uuid not null references auth.users(id) on delete cascade,
  hit_at timestamptz not null default pg_catalog.now()
);

create index health_ingest_hits_owner_hit_idx
  on public.health_ingest_hits (owner_id, hit_at desc);

comment on table public.health_ingest_hits is
  'Rate-limit hits for Apple Health ingest. No health measurements.';

create table public.health_sleep_ingest (
  owner_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  game_day date not null,
  sleep_start timestamptz not null,
  sleep_end timestamptz not null,
  source text not null check (source = 'apple_health'),
  source_name text,
  credited boolean not null,
  created_at timestamptz not null default pg_catalog.now(),
  primary key (owner_id, request_id),
  unique (owner_id, game_day),
  constraint health_sleep_ingest_span check (
    sleep_end > sleep_start and sleep_end <= sleep_start + interval '20 hours'
  ),
  constraint health_sleep_ingest_source_name check (
    source_name is null or source_name ~ '^[A-Za-z0-9][A-Za-z0-9 .+'')(&-]{0,39}$'
  )
);

comment on table public.health_sleep_ingest is
  'Sleep start, sleep end, and Apple Health source for one lights-out night. No other health data.';

create table public.health_nutrition_requests (
  owner_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  game_day date not null,
  created_at timestamptz not null default pg_catalog.now(),
  primary key (owner_id, request_id)
);

comment on table public.health_nutrition_requests is
  'Nutrition request ids. A repeat is rejected and does not change the day.';

create table public.health_nutrition_days (
  owner_id uuid not null references auth.users(id) on delete cascade,
  game_day date not null,
  energy_kcal numeric(8, 2),
  protein_g numeric(7, 2),
  carbs_g numeric(7, 2),
  fat_g numeric(7, 2),
  source text not null check (source = 'cronometer'),
  basis text not null check (basis in ('diary_date', 'game_window')),
  read_status text not null check (read_status in ('complete', 'partial', 'failed')),
  observed_at timestamptz not null,
  updated_at timestamptz not null default pg_catalog.now(),
  primary key (owner_id, game_day),
  constraint health_nutrition_days_kcal check (
    energy_kcal is null or (energy_kcal >= 0 and energy_kcal <= 20000)
  ),
  constraint health_nutrition_days_protein check (
    protein_g is null or (protein_g >= 0 and protein_g <= 2000)
  ),
  constraint health_nutrition_days_carbs check (
    carbs_g is null or (carbs_g >= 0 and carbs_g <= 2000)
  ),
  constraint health_nutrition_days_fat check (
    fat_g is null or (fat_g >= 0 and fat_g <= 2000)
  )
);

comment on table public.health_nutrition_days is
  'Owner-only Cronometer shadow import. Energy and three macros only. 0 XP. Not for Izzy, shared cards, badges, profile export, or MCP. Null is missing. Zero is a real observation.';

alter table public.health_ingest_tokens enable row level security;
alter table public.health_ingest_hits enable row level security;
alter table public.health_sleep_ingest enable row level security;
alter table public.health_nutrition_requests enable row level security;
alter table public.health_nutrition_days enable row level security;
alter table public.health_ingest_tokens force row level security;
alter table public.health_ingest_hits force row level security;
alter table public.health_sleep_ingest force row level security;
alter table public.health_nutrition_requests force row level security;
alter table public.health_nutrition_days force row level security;

revoke all on public.health_ingest_tokens, public.health_ingest_hits, public.health_sleep_ingest,
  public.health_nutrition_requests, public.health_nutrition_days from public, anon, authenticated;

grant select (
  id, owner_id, token_prefix, created_at, last_used_at, revoked_at
) on public.health_ingest_tokens to authenticated;
grant select on public.health_sleep_ingest to authenticated;
grant select on public.health_nutrition_requests to authenticated;
grant select on public.health_nutrition_days to authenticated;

create policy health_ingest_tokens_owner_read on public.health_ingest_tokens
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy health_sleep_ingest_owner_read on public.health_sleep_ingest
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy health_nutrition_requests_owner_read on public.health_nutrition_requests
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy health_nutrition_days_owner_read on public.health_nutrition_days
  for select to authenticated using ((select auth.uid()) = owner_id);

create view public.health_ingest_tokens_safe
with (security_barrier = true, security_invoker = true) as
select id, owner_id, token_prefix, created_at, last_used_at, revoked_at
from public.health_ingest_tokens
where owner_id = (select auth.uid());

comment on view public.health_ingest_tokens_safe is
  'Caller-owned ingest token metadata. Excludes token_hash.';

revoke all on public.health_ingest_tokens_safe from public, anon, authenticated;
grant select on public.health_ingest_tokens_safe to authenticated;

create or replace function public.apple_health_game_day(p_at timestamptz)
returns date
language sql
stable
strict
set search_path = ''
as $$
  select ((p_at at time zone 'America/Chicago') - interval '5 hours')::date
$$;

revoke all on function public.apple_health_game_day(timestamptz) from public, anon;
grant execute on function public.apple_health_game_day(timestamptz) to authenticated;

comment on function public.apple_health_game_day(timestamptz) is
  '5:00 AM America/Chicago game day. 4:59 AM belongs to the previous day. 5:00 AM starts the new day.';

-- LIGHTS_OUT_NIGHT_START = 17:00. LIGHTS_OUT_DEADLINE = 23:00. Game day closes at 05:00.
create or replace function public.apple_health_sleep_decision(p_start timestamptz)
returns jsonb
language sql
stable
strict
set search_path = ''
as $$
  with day as (
    select public.apple_health_game_day(p_start) as game_day
  )
  select jsonb_build_object(
    'game_day', day.game_day,
    'in_night', p_start >= ((day.game_day::timestamp + time '17:00') at time zone 'America/Chicago')
      and p_start < (((day.game_day + 1)::timestamp + time '05:00') at time zone 'America/Chicago'),
    'credit', p_start >= ((day.game_day::timestamp + time '17:00') at time zone 'America/Chicago')
      and p_start <= ((day.game_day::timestamp + time '23:00') at time zone 'America/Chicago')
  )
  from day
$$;

revoke all on function public.apple_health_sleep_decision(timestamptz) from public, anon;
grant execute on function public.apple_health_sleep_decision(timestamptz) to authenticated;

create or replace function public.issue_health_ingest_token(p_rotate boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_active uuid;
  v_secret text;
  v_token text;
  v_hash text;
  v_id uuid;
begin
  if v_owner is null then raise exception 'Sign-in required'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('health-ingest-token:' || v_owner::text, 0));
  select id into v_active from public.health_ingest_tokens
    where owner_id = v_owner and revoked_at is null;
  if coalesce(p_rotate, false) then
    if v_active is null then raise exception 'There is no token to rotate'; end if;
    update public.health_ingest_tokens set revoked_at = pg_catalog.now() where id = v_active;
  elsif v_active is not null then
    raise exception 'A token already exists. Rotate it to replace it.';
  end if;
  if (select count(*) from public.health_ingest_tokens
        where owner_id = v_owner and created_at > pg_catalog.now() - interval '1 hour') >= 10 then
    raise exception 'Wait before creating another token';
  end if;
  v_secret := pg_catalog.rtrim(pg_catalog.translate(pg_catalog.encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=');
  v_token := 'la_sleep_' || v_secret;
  v_hash := encode(extensions.digest(pg_catalog.convert_to(v_token, 'UTF8'), 'sha256'), 'hex');
  insert into public.health_ingest_tokens (owner_id, token_prefix, token_hash)
  values (v_owner, pg_catalog.left(v_token, 17), v_hash)
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'prefix', pg_catalog.left(v_token, 17), 'token', v_token);
end $$;

revoke all on function public.issue_health_ingest_token(boolean) from public, anon;
grant execute on function public.issue_health_ingest_token(boolean) to authenticated;

create or replace function public.revoke_health_ingest_token()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
begin
  if v_owner is null then raise exception 'Sign-in required'; end if;
  update public.health_ingest_tokens
    set revoked_at = pg_catalog.now()
    where owner_id = v_owner and revoked_at is null;
  if not found then raise exception 'There is no token to revoke'; end if;
  return jsonb_build_object('revoked', true);
end $$;

revoke all on function public.revoke_health_ingest_token() from public, anon;
grant execute on function public.revoke_health_ingest_token() to authenticated;


create or replace function public.ingest_apple_health(
  p_token_hash text,
  p_request_id uuid,
  p_sleep_start timestamptz default null,
  p_sleep_end timestamptz default null,
  p_source text default null,
  p_sleep_source_name text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rec record;
  v_owner uuid;
  v_provided bytea;
  v_stored bytea;
  v_diff integer := 0;
  v_i integer;
  v_today date;
  v_hits integer;
  v_decision jsonb;
  v_game_day date;
  v_in_night boolean := false;
  v_credit boolean := false;
  v_sleep_name text;
  v_existing public.health_sleep_ingest%rowtype;
  v_lights jsonb;
  v_xp integer := 0;
  v_credited boolean := false;
  v_sleep jsonb := null;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' or p_request_id is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized', 'xp_awarded', 0);
  end if;
  v_provided := pg_catalog.decode(p_token_hash, 'hex');
  select id, owner_id, token_hash, revoked_at into v_rec
    from public.health_ingest_tokens where token_hash = p_token_hash;
  if not found or v_rec.revoked_at is not null then
    for v_i in 0 .. pg_catalog.octet_length(v_provided) - 1 loop
      v_diff := v_diff | (pg_catalog.get_byte(v_provided, v_i) # pg_catalog.get_byte(v_provided, v_i));
    end loop;
    return jsonb_build_object('ok', false, 'error', 'unauthorized', 'xp_awarded', 0);
  end if;
  v_stored := pg_catalog.decode(v_rec.token_hash, 'hex');
  for v_i in 0 .. pg_catalog.octet_length(v_provided) - 1 loop
    v_diff := v_diff | (pg_catalog.get_byte(v_provided, v_i) # pg_catalog.get_byte(v_stored, v_i));
  end loop;
  if v_diff <> 0 then
    return jsonb_build_object('ok', false, 'error', 'unauthorized', 'xp_awarded', 0);
  end if;
  v_owner := v_rec.owner_id;
  update public.health_ingest_tokens set last_used_at = pg_catalog.now() where id = v_rec.id and revoked_at is null;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('apple-health:' || v_owner::text, 0));
  delete from public.health_ingest_hits
    where owner_id = v_owner and hit_at < pg_catalog.now() - interval '2 days';
  insert into public.health_ingest_hits (owner_id) values (v_owner);
  select count(*) into v_hits from public.health_ingest_hits
    where owner_id = v_owner and hit_at > pg_catalog.now() - interval '1 hour';
  if v_hits > 30 then
    return jsonb_build_object('ok', false, 'error', 'rate_limited', 'xp_awarded', 0);
  end if;

  if p_sleep_start is null and p_sleep_end is null then
    return jsonb_build_object('ok', false, 'error', 'invalid', 'xp_awarded', 0);
  end if;
  if p_sleep_start is null or p_sleep_end is null or p_sleep_end <= p_sleep_start
     or p_sleep_end > p_sleep_start + interval '20 hours' or p_source is distinct from 'apple_health' then
    return jsonb_build_object('ok', false, 'error', 'invalid', 'xp_awarded', 0);
  end if;
  v_sleep_name := nullif(pg_catalog.btrim(coalesce(p_sleep_source_name, '')), '');
  if v_sleep_name is not null and v_sleep_name !~ '^[A-Za-z0-9][A-Za-z0-9 .()+&-]{0,39}$' then
    return jsonb_build_object('ok', false, 'error', 'invalid', 'xp_awarded', 0);
  end if;

  perform pg_catalog.set_config('request.jwt.claim.sub', v_owner::text, true);
  perform pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
  v_today := public.quest_today();
  v_decision := public.apple_health_sleep_decision(p_sleep_start);
  v_game_day := (v_decision->>'game_day')::date;
  v_in_night := (v_decision->>'in_night')::boolean;
  v_credit := (v_decision->>'credit')::boolean;
  if v_in_night and (v_game_day > v_today or v_game_day < v_today - 2) then
    return jsonb_build_object('ok', false, 'error', 'old_night', 'xp_awarded', 0);
  end if;

  if v_in_night then
    select * into v_existing from public.health_sleep_ingest
      where owner_id = v_owner and (request_id = p_request_id or game_day = v_game_day)
      limit 1;
    if found then
      v_sleep := jsonb_build_object('game_day', v_existing.game_day, 'xp_awarded', 0, 'already', true, 'credited', false, 'receipt', null);
    else
      if v_credit then
        v_lights := public.record_lights_out(v_game_day, p_request_id);
        v_xp := coalesce((v_lights->>'xp_awarded')::integer, 0);
        v_credited := coalesce((v_lights->>'already')::boolean, true) is not true;
      end if;
      insert into public.health_sleep_ingest (
        owner_id, request_id, game_day, sleep_start, sleep_end, source, source_name, credited
      ) values (
        v_owner, p_request_id, v_game_day, p_sleep_start, p_sleep_end, 'apple_health', v_sleep_name, v_credited
      );
      v_sleep := jsonb_build_object(
        'game_day', v_game_day,
        'xp_awarded', v_xp,
        'already', not v_credited and v_credit,
        'credited', v_credited,
        'receipt', case when v_credited then
          case when v_sleep_name is null then 'Auto from Apple Health'
               else 'Auto from Apple Health (' || v_sleep_name || ')' end
          else null end
      );
    end if;
  else
    v_sleep := jsonb_build_object('game_day', v_game_day, 'xp_awarded', 0, 'already', false, 'credited', false, 'receipt', null);
  end if;

  return jsonb_build_object('ok', true, 'xp_awarded', v_xp, 'sleep', v_sleep);
exception
  when unique_violation then
    return jsonb_build_object('ok', true, 'xp_awarded', 0, 'sleep', jsonb_build_object('already', true, 'xp_awarded', 0, 'credited', false, 'receipt', null));
  when check_violation then
    return jsonb_build_object('ok', false, 'error', 'invalid', 'xp_awarded', 0);
  when others then
    if sqlerrm = 'Choose an eligible lights-out night' then
      return jsonb_build_object('ok', false, 'error', 'old_night', 'xp_awarded', 0);
    end if;
    raise;
end $$;

revoke all on function public.ingest_apple_health(text, uuid, timestamptz, timestamptz, text, text) from public;
grant execute on function public.ingest_apple_health(text, uuid, timestamptz, timestamptz, text, text) to anon, authenticated;

-- Nutrition is its own function so a bad Cronometer read cannot roll back Lights Out.
create or replace function public.ingest_cronometer_nutrition(
  p_token_hash text,
  p_request_id uuid,
  p_game_day date,
  p_observed_at timestamptz,
  p_basis text,
  p_read_status text,
  p_energy_kcal numeric default null,
  p_protein_g numeric default null,
  p_carbs_g numeric default null,
  p_fat_g numeric default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rec record;
  v_owner uuid;
  v_provided bytea;
  v_stored bytea;
  v_diff integer := 0;
  v_i integer;
  v_today date;
  v_hits integer;
  v_row public.health_nutrition_days%rowtype;
  v_energy numeric(8, 2);
  v_protein numeric(7, 2);
  v_carbs numeric(7, 2);
  v_fat numeric(7, 2);
  v_stale boolean := false;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' or p_request_id is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized', 'xp_awarded', 0);
  end if;
  v_provided := pg_catalog.decode(p_token_hash, 'hex');
  select id, owner_id, token_hash, revoked_at into v_rec
    from public.health_ingest_tokens where token_hash = p_token_hash;
  if not found or v_rec.revoked_at is not null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized', 'xp_awarded', 0);
  end if;
  v_stored := pg_catalog.decode(v_rec.token_hash, 'hex');
  for v_i in 0 .. pg_catalog.octet_length(v_provided) - 1 loop
    v_diff := v_diff | (pg_catalog.get_byte(v_provided, v_i) # pg_catalog.get_byte(v_stored, v_i));
  end loop;
  if v_diff <> 0 then
    return jsonb_build_object('ok', false, 'error', 'unauthorized', 'xp_awarded', 0);
  end if;
  v_owner := v_rec.owner_id;
  update public.health_ingest_tokens set last_used_at = pg_catalog.now() where id = v_rec.id and revoked_at is null;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('apple-health:' || v_owner::text, 0));
  delete from public.health_ingest_hits
    where owner_id = v_owner and hit_at < pg_catalog.now() - interval '2 days';
  insert into public.health_ingest_hits (owner_id) values (v_owner);
  select count(*) into v_hits from public.health_ingest_hits
    where owner_id = v_owner and hit_at > pg_catalog.now() - interval '1 hour';
  if v_hits > 30 then
    return jsonb_build_object('ok', false, 'error', 'rate_limited', 'xp_awarded', 0);
  end if;

  if exists (
    select 1 from public.health_nutrition_requests
    where owner_id = v_owner and request_id = p_request_id
  ) then
    return jsonb_build_object('ok', false, 'error', 'duplicate_request_id', 'xp_awarded', 0);
  end if;
  if p_game_day is null or p_observed_at is null
     or p_basis not in ('diary_date', 'game_window')
     or p_read_status not in ('complete', 'partial', 'failed') then
    return jsonb_build_object('ok', false, 'error', 'invalid', 'xp_awarded', 0);
  end if;
  perform pg_catalog.set_config('request.jwt.claim.sub', v_owner::text, true);
  perform pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
  v_today := public.quest_today();
  if p_game_day > v_today or p_game_day < v_today - 2 then
    return jsonb_build_object('ok', false, 'error', 'old_night', 'xp_awarded', 0);
  end if;

  -- A failed read is telemetry. Its totals are unverified and must not be stored.
  if p_read_status = 'failed' then
    v_energy := null; v_protein := null; v_carbs := null; v_fat := null;
  else
    v_energy := p_energy_kcal; v_protein := p_protein_g; v_carbs := p_carbs_g; v_fat := p_fat_g;
  end if;
  if (v_energy is not null and (v_energy < 0 or v_energy > 20000))
     or (v_protein is not null and (v_protein < 0 or v_protein > 2000))
     or (v_carbs is not null and (v_carbs < 0 or v_carbs > 2000))
     or (v_fat is not null and (v_fat < 0 or v_fat > 2000)) then
    return jsonb_build_object('ok', false, 'error', 'invalid', 'xp_awarded', 0);
  end if;

  insert into public.health_nutrition_requests (owner_id, request_id, game_day)
  values (v_owner, p_request_id, p_game_day);
  select * into v_row from public.health_nutrition_days
    where owner_id = v_owner and game_day = p_game_day;
  if not found then
    insert into public.health_nutrition_days (
      owner_id, game_day, energy_kcal, protein_g, carbs_g, fat_g, source, basis, read_status, observed_at
    ) values (
      v_owner, p_game_day, v_energy, v_protein, v_carbs, v_fat, 'cronometer', p_basis, p_read_status, p_observed_at
    );
  elsif p_observed_at < v_row.observed_at then
    v_stale := true;
  else
    update public.health_nutrition_days set
      energy_kcal = coalesce(v_energy, energy_kcal),
      protein_g = coalesce(v_protein, protein_g),
      carbs_g = coalesce(v_carbs, carbs_g),
      fat_g = coalesce(v_fat, fat_g),
      basis = p_basis,
      read_status = p_read_status,
      observed_at = p_observed_at,
      updated_at = pg_catalog.now()
    where owner_id = v_owner and game_day = p_game_day;
  end if;

  select * into v_row from public.health_nutrition_days
    where owner_id = v_owner and game_day = p_game_day;
  return jsonb_build_object(
    'ok', true,
    'xp_awarded', 0,
    'stale', v_stale,
    'nutrition', jsonb_build_object(
      'game_date', v_row.game_day,
      'energy_kcal', v_row.energy_kcal,
      'protein_g', v_row.protein_g,
      'carbs_g', v_row.carbs_g,
      'fat_g', v_row.fat_g,
      'source', v_row.source,
      'basis', v_row.basis,
      'read_status', v_row.read_status,
      'observed_at', v_row.observed_at,
      'xp_awarded', 0
    )
  );
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'duplicate_request_id', 'xp_awarded', 0);
  when check_violation then
    return jsonb_build_object('ok', false, 'error', 'invalid', 'xp_awarded', 0);
end $$;

revoke all on function public.ingest_cronometer_nutrition(text, uuid, date, timestamptz, text, text, numeric, numeric, numeric, numeric) from public;
grant execute on function public.ingest_cronometer_nutrition(text, uuid, date, timestamptz, text, text, numeric, numeric, numeric, numeric) to anon, authenticated;
