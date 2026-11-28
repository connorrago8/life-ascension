-- Nutrition diary for TEST. Additive. Does not alter health_meals, xp_ledger,
-- streaks, quests, finance, or pharmacy.
--
-- health_meals stays the one-row-per-day flag log (0 XP). This diary is many
-- meals per game day, with an explicit diary_date. The game day is 5:00 AM
-- America/Chicago via quest_game_day, not the profile time zone.
--
-- Paid AI and photo logging are application flags. This migration does not
-- call a model. Confirming a meal awards 0 XP.
--
-- nutrition:read style access is a grant table only. The read function is
-- revoked from anon, authenticated, and service_role. There is no settings UI.
--
-- Reverse with supabase/rollbacks/202611280010_nutrition_diary_down.sql.
-- Do not apply to production project ugcvhmrriazbbymjxvch.

create table public.nutrition_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  diary_date date not null,
  meal_label text not null default 'Meal' check (char_length(pg_catalog.btrim(meal_label)) between 1 and 40),
  note text check (note is null or char_length(note) <= 500),
  source_text text check (source_text is null or char_length(source_text) <= 1000),
  idempotency_key uuid not null,
  origin text not null check (origin in ('text', 'photo', 'favorite')),
  log_started_at timestamptz,
  log_duration_ms integer check (log_duration_ms is null or (log_duration_ms >= 0 and log_duration_ms <= 1800000)),
  parse_request_id uuid,
  parse_input_tokens integer check (parse_input_tokens is null or parse_input_tokens >= 0),
  parse_output_tokens integer check (parse_output_tokens is null or parse_output_tokens >= 0),
  parse_estimated_usd numeric(12, 6) check (parse_estimated_usd is null or parse_estimated_usd >= 0),
  confirmed_at timestamptz not null default pg_catalog.now(),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique (owner_id, idempotency_key),
  unique (id, owner_id)
);

create index nutrition_entries_owner_day_idx on public.nutrition_entries (owner_id, diary_date desc);

create table public.nutrition_items (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null,
  owner_id uuid not null,
  position integer not null check (position >= 0 and position < 30),
  name text not null check (char_length(pg_catalog.btrim(name)) between 1 and 120),
  quantity numeric(10, 3) not null check (quantity > 0 and quantity <= 10000),
  unit text not null check (char_length(pg_catalog.btrim(unit)) between 1 and 24),
  calories numeric(8, 2) not null check (calories >= 0 and calories <= 20000),
  protein_g numeric(8, 2) not null check (protein_g >= 0 and protein_g <= 1000),
  carbs_g numeric(8, 2) not null check (carbs_g >= 0 and carbs_g <= 1000),
  fat_g numeric(8, 2) not null check (fat_g >= 0 and fat_g <= 1000),
  fiber_g numeric(8, 2) check (fiber_g is null or (fiber_g >= 0 and fiber_g <= 1000)),
  fluid_oz numeric(8, 2) check (fluid_oz is null or (fluid_oz >= 0 and fluid_oz <= 500)),
  source text not null check (source in ('usda_fdc', 'ai_text', 'ai_photo', 'user_edited', 'generic', 'personal', 'convention')),
  confidence text not null check (confidence in ('stated', 'typical', 'low')),
  fdc_id bigint check (fdc_id is null or fdc_id > 0),
  fdc_description text check (fdc_description is null or char_length(fdc_description) <= 200),
  assumption text check (assumption is null or char_length(assumption) <= 300),
  source_label text not null check (char_length(source_label) between 1 and 160),
  unique (entry_id, position),
  foreign key (entry_id, owner_id) references public.nutrition_entries (id, owner_id) on delete cascade,
  constraint nutrition_items_fdc_source check (
    (source = 'usda_fdc' and fdc_id is not null)
    or (source <> 'usda_fdc' and fdc_id is null)
  )
);

create index nutrition_items_owner_entry_idx on public.nutrition_items (owner_id, entry_id);

create table public.saved_meals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(pg_catalog.btrim(name)) between 1 and 80),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique (id, owner_id)
);

create unique index saved_meals_owner_name_idx on public.saved_meals (owner_id, lower(name));
create index saved_meals_owner_updated_idx on public.saved_meals (owner_id, updated_at desc);

create table public.saved_meal_items (
  id uuid primary key default gen_random_uuid(),
  saved_meal_id uuid not null,
  owner_id uuid not null,
  position integer not null check (position >= 0 and position < 30),
  name text not null check (char_length(pg_catalog.btrim(name)) between 1 and 120),
  quantity numeric(10, 3) not null check (quantity > 0 and quantity <= 10000),
  unit text not null check (char_length(pg_catalog.btrim(unit)) between 1 and 24),
  calories numeric(8, 2) not null check (calories >= 0 and calories <= 20000),
  protein_g numeric(8, 2) not null check (protein_g >= 0 and protein_g <= 1000),
  carbs_g numeric(8, 2) not null check (carbs_g >= 0 and carbs_g <= 1000),
  fat_g numeric(8, 2) not null check (fat_g >= 0 and fat_g <= 1000),
  fiber_g numeric(8, 2) check (fiber_g is null or (fiber_g >= 0 and fiber_g <= 1000)),
  fluid_oz numeric(8, 2) check (fluid_oz is null or (fluid_oz >= 0 and fluid_oz <= 500)),
  source text not null check (source in ('usda_fdc', 'ai_text', 'ai_photo', 'user_edited', 'generic', 'personal', 'convention')),
  confidence text not null check (confidence in ('stated', 'typical', 'low')),
  fdc_id bigint check (fdc_id is null or fdc_id > 0),
  assumption text check (assumption is null or char_length(assumption) <= 300),
  unique (saved_meal_id, position),
  foreign key (saved_meal_id, owner_id) references public.saved_meals (id, owner_id) on delete cascade,
  constraint saved_meal_items_fdc_source check (
    (source = 'usda_fdc' and fdc_id is not null)
    or (source <> 'usda_fdc' and fdc_id is null)
  )
);

create index saved_meal_items_owner_idx on public.saved_meal_items (owner_id, saved_meal_id);

create table public.nutrition_aliases (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  alias text not null check (char_length(pg_catalog.btrim(alias)) between 1 and 80),
  saved_meal_id uuid not null,
  created_at timestamptz not null default pg_catalog.now(),
  foreign key (saved_meal_id, owner_id) references public.saved_meals (id, owner_id) on delete cascade
);

create unique index nutrition_aliases_owner_alias_idx on public.nutrition_aliases (owner_id, lower(alias));

create table public.nutrition_portion_memory (
  owner_id uuid not null references auth.users(id) on delete cascade,
  food_key text not null check (char_length(pg_catalog.btrim(food_key)) between 1 and 80),
  quantity numeric(10, 3) not null check (quantity > 0 and quantity <= 10000),
  unit text not null check (char_length(pg_catalog.btrim(unit)) between 1 and 24),
  calories numeric(8, 2) not null check (calories >= 0 and calories <= 20000),
  protein_g numeric(8, 2) not null check (protein_g >= 0 and protein_g <= 1000),
  carbs_g numeric(8, 2) not null check (carbs_g >= 0 and carbs_g <= 1000),
  fat_g numeric(8, 2) not null check (fat_g >= 0 and fat_g <= 1000),
  fiber_g numeric(8, 2) check (fiber_g is null or (fiber_g >= 0 and fiber_g <= 1000)),
  fluid_oz numeric(8, 2) check (fluid_oz is null or (fluid_oz >= 0 and fluid_oz <= 500)),
  updated_at timestamptz not null default pg_catalog.now(),
  primary key (owner_id, food_key)
);

create table public.nutrition_parse_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  channel text not null check (channel in ('text', 'photo')),
  provider text not null check (provider in ('deterministic', 'fdc', 'gateway', 'unconfigured')),
  model text,
  input_tokens integer not null default 0 check (input_tokens >= 0 and input_tokens <= 200000),
  output_tokens integer not null default 0 check (output_tokens >= 0 and output_tokens <= 200000),
  estimated_usd numeric(12, 6) not null default 0 check (estimated_usd >= 0 and estimated_usd <= 5),
  duration_ms integer not null check (duration_ms >= 0 and duration_ms <= 120000),
  created_at timestamptz not null default pg_catalog.now(),
  unique (owner_id, request_id)
);

create index nutrition_parse_events_owner_idx on public.nutrition_parse_events (owner_id, created_at desc);

-- Per-assistant read grants. No write scope exists. Finance and pharmacy are
-- not readable here. Execute on the reader stays revoked.
create table public.nutrition_ai_grants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  assistant text not null check (assistant in ('chatgpt', 'grok')),
  label text not null check (char_length(pg_catalog.btrim(label)) between 1 and 80),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  scopes text[] not null check (
    cardinality(scopes) >= 1
    and scopes <@ array['nutrition:summary', 'nutrition:history', 'nutrition:trends', 'nutrition:saved']::text[]
  ),
  created_at timestamptz not null default pg_catalog.now(),
  revoked_at timestamptz,
  last_access_at timestamptz
);

create index nutrition_ai_grants_owner_idx on public.nutrition_ai_grants (owner_id, created_at desc);

alter table public.nutrition_entries enable row level security;
alter table public.nutrition_items enable row level security;
alter table public.saved_meals enable row level security;
alter table public.saved_meal_items enable row level security;
alter table public.nutrition_aliases enable row level security;
alter table public.nutrition_portion_memory enable row level security;
alter table public.nutrition_parse_events enable row level security;
alter table public.nutrition_ai_grants enable row level security;
alter table public.nutrition_entries force row level security;
alter table public.nutrition_items force row level security;
alter table public.saved_meals force row level security;
alter table public.saved_meal_items force row level security;
alter table public.nutrition_aliases force row level security;
alter table public.nutrition_portion_memory force row level security;
alter table public.nutrition_parse_events force row level security;
alter table public.nutrition_ai_grants force row level security;

revoke all on public.nutrition_entries, public.nutrition_items, public.saved_meals,
  public.saved_meal_items, public.nutrition_aliases, public.nutrition_portion_memory,
  public.nutrition_parse_events, public.nutrition_ai_grants from public, anon, authenticated;

grant select on public.nutrition_entries, public.nutrition_items, public.saved_meals,
  public.saved_meal_items, public.nutrition_aliases, public.nutrition_portion_memory,
  public.nutrition_parse_events to authenticated;

grant select (id, owner_id, assistant, label, scopes, created_at, revoked_at, last_access_at)
  on public.nutrition_ai_grants to authenticated;

create policy nutrition_entries_owner_read on public.nutrition_entries
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy nutrition_items_owner_read on public.nutrition_items
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy saved_meals_owner_read on public.saved_meals
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy saved_meal_items_owner_read on public.saved_meal_items
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy nutrition_aliases_owner_read on public.nutrition_aliases
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy nutrition_portion_memory_owner_read on public.nutrition_portion_memory
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy nutrition_parse_events_owner_read on public.nutrition_parse_events
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy nutrition_ai_grants_owner_read on public.nutrition_ai_grants
  for select to authenticated using ((select auth.uid()) = owner_id);

create or replace function public._nutrition_diary_allowed(p_day date)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := public.quest_game_day(pg_catalog.now(), 'America/Chicago');
begin
  return p_day is not null and p_day <= v_today and p_day >= v_today - 14;
end $$;
revoke all on function public._nutrition_diary_allowed(date) from public, anon, authenticated, service_role;

create or replace function public._nutrition_replace_items(p_entry uuid, p_owner uuid, p_items jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_index integer := 0;
  v_name text;
  v_source text;
  v_confidence text;
  v_fdc bigint;
  v_desc text;
  v_label text;
begin
  if pg_catalog.jsonb_typeof(p_items) <> 'array'
     or pg_catalog.jsonb_array_length(p_items) < 1
     or pg_catalog.jsonb_array_length(p_items) > 30 then
    raise exception 'Log between 1 and 30 foods';
  end if;
  delete from public.nutrition_items where entry_id = p_entry and owner_id = p_owner;
  for v_item in select value from pg_catalog.jsonb_array_elements(p_items) loop
    v_name := nullif(pg_catalog.btrim(coalesce(v_item->>'name', '')), '');
    v_source := v_item->>'source';
    v_confidence := coalesce(v_item->>'confidence', 'typical');
    if v_name is null or char_length(v_name) > 120 then raise exception 'Each food needs a name'; end if;
    if v_source not in ('usda_fdc', 'ai_text', 'ai_photo', 'user_edited', 'generic', 'personal', 'convention') then
      raise exception 'Each food needs a source';
    end if;
    if v_confidence not in ('stated', 'typical', 'low') then raise exception 'Each food needs a confidence'; end if;
    v_fdc := nullif(v_item->>'fdc_id', '')::bigint;
    if v_source = 'usda_fdc' and v_fdc is null then raise exception 'A USDA match needs an FDC id'; end if;
    if v_source <> 'usda_fdc' then v_fdc := null; end if;
    v_desc := nullif(pg_catalog.left(pg_catalog.btrim(coalesce(v_item->>'fdc_description', '')), 200), '');
    v_label := case v_source
      when 'usda_fdc' then 'USDA match'
      when 'ai_text' then 'AI estimate'
      when 'ai_photo' then 'AI estimate'
      when 'user_edited' then 'You entered'
      when 'personal' then 'Saved meal'
      else 'Estimate, you can edit this'
    end;
    insert into public.nutrition_items (
      entry_id, owner_id, position, name, quantity, unit, calories, protein_g, carbs_g, fat_g,
      fiber_g, fluid_oz, source, confidence, fdc_id, fdc_description, assumption, source_label
    ) values (
      p_entry, p_owner, v_index, v_name,
      (v_item->>'quantity')::numeric,
      coalesce(nullif(pg_catalog.btrim(coalesce(v_item->>'unit', '')), ''), 'serving'),
      (v_item->>'calories')::numeric,
      (v_item->>'protein_g')::numeric,
      (v_item->>'carbs_g')::numeric,
      (v_item->>'fat_g')::numeric,
      nullif(v_item->>'fiber_g', '')::numeric,
      nullif(v_item->>'fluid_oz', '')::numeric,
      v_source, v_confidence, v_fdc, case when v_fdc is null then null else v_desc end,
      nullif(pg_catalog.left(pg_catalog.btrim(coalesce(v_item->>'assumption', '')), 300), ''),
      v_label
    );
    v_index := v_index + 1;
  end loop;
exception
  when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'Nutrition numbers are invalid';
end $$;
revoke all on function public._nutrition_replace_items(uuid, uuid, jsonb) from public, anon, authenticated, service_role;

create or replace function public.confirm_nutrition_entry(
  p_idempotency_key uuid,
  p_diary_date date,
  p_meal_label text,
  p_note text,
  p_source_text text,
  p_items jsonb,
  p_log_started_at timestamptz,
  p_parse_request_id uuid,
  p_origin text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_existing public.nutrition_entries%rowtype;
  v_id uuid;
  v_label text;
  v_ms integer;
  v_in integer;
  v_out integer;
  v_usd numeric;
begin
  if v_owner is null then raise exception 'Sign-in required'; end if;
  if p_idempotency_key is null then raise exception 'Missing idempotency key'; end if;
  if p_origin not in ('text', 'photo', 'favorite') then raise exception 'Invalid meal origin'; end if;
  if not public._nutrition_diary_allowed(p_diary_date) then
    raise exception 'Choose a diary date from this game day or the previous 14';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('nutrition:' || v_owner::text || ':' || p_idempotency_key::text, 0));
  select * into v_existing from public.nutrition_entries
    where owner_id = v_owner and idempotency_key = p_idempotency_key;
  if found then
    return pg_catalog.jsonb_build_object(
      'already', true, 'xp_awarded', 0, 'entry_id', v_existing.id, 'diary_date', v_existing.diary_date,
      'log_duration_ms', v_existing.log_duration_ms
    );
  end if;
  v_label := coalesce(nullif(pg_catalog.btrim(coalesce(p_meal_label, '')), ''), 'Meal');
  if char_length(v_label) > 40 then v_label := pg_catalog.left(v_label, 40); end if;
  if p_log_started_at is not null
     and p_log_started_at <= pg_catalog.now()
     and pg_catalog.now() - p_log_started_at <= interval '30 minutes' then
    v_ms := floor(pg_catalog.date_part('epoch', pg_catalog.now() - p_log_started_at) * 1000)::integer;
  end if;
  if p_parse_request_id is not null then
    select input_tokens, output_tokens, estimated_usd
      into v_in, v_out, v_usd
      from public.nutrition_parse_events
      where owner_id = v_owner and request_id = p_parse_request_id;
  end if;
  insert into public.nutrition_entries (
    owner_id, diary_date, meal_label, note, source_text, idempotency_key, origin,
    log_started_at, log_duration_ms, parse_request_id, parse_input_tokens, parse_output_tokens, parse_estimated_usd
  ) values (
    v_owner, p_diary_date, v_label,
    nullif(pg_catalog.btrim(coalesce(p_note, '')), ''),
    nullif(pg_catalog.left(pg_catalog.btrim(coalesce(p_source_text, '')), 1000), ''),
    p_idempotency_key, p_origin, p_log_started_at, v_ms, p_parse_request_id, v_in, v_out, v_usd
  ) returning id into v_id;
  perform public._nutrition_replace_items(v_id, v_owner, p_items);
  return pg_catalog.jsonb_build_object(
    'already', false, 'xp_awarded', 0, 'entry_id', v_id, 'diary_date', p_diary_date, 'log_duration_ms', v_ms
  );
exception when unique_violation then
  select * into v_existing from public.nutrition_entries
    where owner_id = v_owner and idempotency_key = p_idempotency_key;
  return pg_catalog.jsonb_build_object(
    'already', true, 'xp_awarded', 0, 'entry_id', v_existing.id, 'diary_date', v_existing.diary_date,
    'log_duration_ms', v_existing.log_duration_ms
  );
end $$;
revoke all on function public.confirm_nutrition_entry(uuid, date, text, text, text, jsonb, timestamptz, uuid, text) from public, anon;
grant execute on function public.confirm_nutrition_entry(uuid, date, text, text, text, jsonb, timestamptz, uuid, text) to authenticated;

create or replace function public.update_nutrition_entry(
  p_entry_id uuid, p_diary_date date, p_meal_label text, p_note text, p_items jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_label text;
begin
  if v_owner is null then raise exception 'Sign-in required'; end if;
  if not public._nutrition_diary_allowed(p_diary_date) then
    raise exception 'Choose a diary date from this game day or the previous 14';
  end if;
  v_label := coalesce(nullif(pg_catalog.btrim(coalesce(p_meal_label, '')), ''), 'Meal');
  update public.nutrition_entries
     set diary_date = p_diary_date,
         meal_label = pg_catalog.left(v_label, 40),
         note = nullif(pg_catalog.btrim(coalesce(p_note, '')), ''),
         updated_at = pg_catalog.now()
   where id = p_entry_id and owner_id = v_owner;
  if not found then raise exception 'Meal not found'; end if;
  perform public._nutrition_replace_items(p_entry_id, v_owner, p_items);
  return pg_catalog.jsonb_build_object('xp_awarded', 0, 'entry_id', p_entry_id, 'diary_date', p_diary_date);
end $$;
revoke all on function public.update_nutrition_entry(uuid, date, text, text, jsonb) from public, anon;
grant execute on function public.update_nutrition_entry(uuid, date, text, text, jsonb) to authenticated;

create or replace function public.delete_nutrition_entry(p_entry_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_owner uuid := auth.uid(); v_day date;
begin
  if v_owner is null then raise exception 'Sign-in required'; end if;
  delete from public.nutrition_entries where id = p_entry_id and owner_id = v_owner returning diary_date into v_day;
  if not found then raise exception 'Meal not found'; end if;
  return pg_catalog.jsonb_build_object('xp_awarded', 0, 'deleted', true, 'diary_date', v_day);
end $$;
revoke all on function public.delete_nutrition_entry(uuid) from public, anon;
grant execute on function public.delete_nutrition_entry(uuid) to authenticated;

create or replace function public.save_nutrition_favorite(p_entry_id uuid, p_name text, p_alias text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_name text;
  v_alias text;
  v_id uuid;
begin
  if v_owner is null then raise exception 'Sign-in required'; end if;
  if not exists (select 1 from public.nutrition_entries where id = p_entry_id and owner_id = v_owner) then
    raise exception 'Meal not found';
  end if;
  v_name := nullif(pg_catalog.btrim(coalesce(p_name, '')), '');
  if v_name is null or char_length(v_name) > 80 then raise exception 'Name the favorite'; end if;
  insert into public.saved_meals (owner_id, name) values (v_owner, v_name)
  on conflict (owner_id, lower(name)) do update set name = excluded.name, updated_at = pg_catalog.now()
  returning id into v_id;
  delete from public.saved_meal_items where saved_meal_id = v_id and owner_id = v_owner;
  insert into public.saved_meal_items (
    saved_meal_id, owner_id, position, name, quantity, unit, calories, protein_g, carbs_g, fat_g,
    fiber_g, fluid_oz, source, confidence, fdc_id, assumption
  )
  select v_id, v_owner, position, name, quantity, unit, calories, protein_g, carbs_g, fat_g,
         fiber_g, fluid_oz, source, confidence, fdc_id, assumption
    from public.nutrition_items where entry_id = p_entry_id and owner_id = v_owner;
  v_alias := nullif(pg_catalog.btrim(coalesce(p_alias, '')), '');
  if v_alias is not null then
    if char_length(v_alias) > 80 then raise exception 'Alias is too long'; end if;
    insert into public.nutrition_aliases (owner_id, alias, saved_meal_id) values (v_owner, v_alias, v_id)
    on conflict (owner_id, lower(alias)) do update set saved_meal_id = excluded.saved_meal_id;
  end if;
  return pg_catalog.jsonb_build_object('xp_awarded', 0, 'saved_meal_id', v_id);
end $$;
revoke all on function public.save_nutrition_favorite(uuid, text, text) from public, anon;
grant execute on function public.save_nutrition_favorite(uuid, text, text) to authenticated;

create or replace function public.log_saved_meal(
  p_saved_meal_id uuid, p_diary_date date, p_idempotency_key uuid, p_log_started_at timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_name text;
  v_existing public.nutrition_entries%rowtype;
  v_id uuid;
  v_items jsonb;
begin
  if v_owner is null then raise exception 'Sign-in required'; end if;
  if p_idempotency_key is null then raise exception 'Missing idempotency key'; end if;
  if not public._nutrition_diary_allowed(p_diary_date) then
    raise exception 'Choose a diary date from this game day or the previous 14';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('nutrition:' || v_owner::text || ':' || p_idempotency_key::text, 0));
  select * into v_existing from public.nutrition_entries
    where owner_id = v_owner and idempotency_key = p_idempotency_key;
  if found then
    return pg_catalog.jsonb_build_object('already', true, 'xp_awarded', 0, 'entry_id', v_existing.id, 'diary_date', v_existing.diary_date);
  end if;
  select name into v_name from public.saved_meals where id = p_saved_meal_id and owner_id = v_owner;
  if not found then raise exception 'Favorite not found'; end if;
  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'name', name, 'quantity', quantity, 'unit', unit, 'calories', calories,
    'protein_g', protein_g, 'carbs_g', carbs_g, 'fat_g', fat_g, 'fiber_g', fiber_g,
    'fluid_oz', fluid_oz, 'source', source, 'confidence', confidence, 'fdc_id', fdc_id,
    'assumption', assumption
  ) order by position) into v_items
  from public.saved_meal_items where saved_meal_id = p_saved_meal_id and owner_id = v_owner;
  insert into public.nutrition_entries (owner_id, diary_date, meal_label, idempotency_key, origin, log_started_at)
  values (v_owner, p_diary_date, pg_catalog.left(v_name, 40), p_idempotency_key, 'favorite', p_log_started_at)
  returning id into v_id;
  perform public._nutrition_replace_items(v_id, v_owner, v_items);
  return pg_catalog.jsonb_build_object('already', false, 'xp_awarded', 0, 'entry_id', v_id, 'diary_date', p_diary_date);
exception when unique_violation then
  select * into v_existing from public.nutrition_entries
    where owner_id = v_owner and idempotency_key = p_idempotency_key;
  return pg_catalog.jsonb_build_object('already', true, 'xp_awarded', 0, 'entry_id', v_existing.id, 'diary_date', coalesce(v_existing.diary_date, p_diary_date));
end $$;
revoke all on function public.log_saved_meal(uuid, date, uuid, timestamptz) from public, anon;
grant execute on function public.log_saved_meal(uuid, date, uuid, timestamptz) to authenticated;

create or replace function public.remember_nutrition_portion(
  p_food_key text, p_quantity numeric, p_unit text, p_calories numeric, p_protein_g numeric,
  p_carbs_g numeric, p_fat_g numeric, p_fiber_g numeric, p_fluid_oz numeric
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_owner uuid := auth.uid(); v_key text;
begin
  if v_owner is null then raise exception 'Sign-in required'; end if;
  v_key := nullif(pg_catalog.lower(pg_catalog.btrim(coalesce(p_food_key, ''))), '');
  if v_key is null then raise exception 'Name the food to remember'; end if;
  insert into public.nutrition_portion_memory (
    owner_id, food_key, quantity, unit, calories, protein_g, carbs_g, fat_g, fiber_g, fluid_oz
  ) values (
    v_owner, v_key, p_quantity, coalesce(nullif(pg_catalog.btrim(coalesce(p_unit, '')), ''), 'serving'),
    p_calories, p_protein_g, p_carbs_g, p_fat_g, p_fiber_g, p_fluid_oz
  )
  on conflict (owner_id, food_key) do update set
    quantity = excluded.quantity, unit = excluded.unit, calories = excluded.calories,
    protein_g = excluded.protein_g, carbs_g = excluded.carbs_g, fat_g = excluded.fat_g,
    fiber_g = excluded.fiber_g, fluid_oz = excluded.fluid_oz, updated_at = pg_catalog.now();
  return pg_catalog.jsonb_build_object('xp_awarded', 0, 'food_key', v_key);
end $$;
revoke all on function public.remember_nutrition_portion(text, numeric, text, numeric, numeric, numeric, numeric, numeric, numeric) from public, anon;
grant execute on function public.remember_nutrition_portion(text, numeric, text, numeric, numeric, numeric, numeric, numeric, numeric) to authenticated;

create or replace function public.record_nutrition_parse(
  p_request_id uuid, p_channel text, p_provider text, p_model text,
  p_input_tokens integer, p_output_tokens integer, p_estimated_usd numeric, p_duration_ms integer
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_owner uuid := auth.uid(); v_count integer; v_id uuid;
begin
  if v_owner is null then raise exception 'Sign-in required'; end if;
  if p_request_id is null then raise exception 'Missing parse request'; end if;
  if p_channel not in ('text', 'photo') or p_provider not in ('deterministic', 'fdc', 'gateway', 'unconfigured') then
    raise exception 'Invalid parse record';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('nutrition-parse:' || v_owner::text, 0));
  select count(*) into v_count from public.nutrition_parse_events
    where owner_id = v_owner and created_at >= pg_catalog.now() - interval '1 hour' and request_id <> p_request_id;
  if v_count >= 30 then raise exception 'Nutrition parse limit reached'; end if;
  insert into public.nutrition_parse_events (
    owner_id, request_id, channel, provider, model, input_tokens, output_tokens, estimated_usd, duration_ms
  ) values (
    v_owner, p_request_id, p_channel, p_provider, nullif(pg_catalog.btrim(coalesce(p_model, '')), ''),
    greatest(coalesce(p_input_tokens, 0), 0), greatest(coalesce(p_output_tokens, 0), 0),
    greatest(coalesce(p_estimated_usd, 0), 0), greatest(coalesce(p_duration_ms, 0), 0)
  )
  on conflict (owner_id, request_id) do nothing
  returning id into v_id;
  return pg_catalog.jsonb_build_object('already', v_id is null, 'xp_awarded', 0);
end $$;
revoke all on function public.record_nutrition_parse(uuid, text, text, text, integer, integer, numeric, integer) from public, anon;
grant execute on function public.record_nutrition_parse(uuid, text, text, text, integer, integer, numeric, integer) to authenticated;

create or replace function public.revoke_nutrition_ai_grant(p_grant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_owner uuid := auth.uid();
begin
  if v_owner is null then raise exception 'Sign-in required'; end if;
  update public.nutrition_ai_grants
     set revoked_at = coalesce(revoked_at, pg_catalog.now())
   where id = p_grant_id and owner_id = v_owner;
  if not found then raise exception 'Grant not found'; end if;
  return pg_catalog.jsonb_build_object('revoked', true);
end $$;
revoke all on function public.revoke_nutrition_ai_grant(uuid) from public, anon;
grant execute on function public.revoke_nutrition_ai_grant(uuid) to authenticated;

-- DISABLED reader. Do not grant execute. Read-only, one assistant credential,
-- owner-scoped nutrition rows only. No modify, no delete, no finance, no pharmacy.
create or replace function public.read_nutrition_for_grant(p_token_hash text, p_diary_date date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_grant public.nutrition_ai_grants%rowtype;
  v_meals jsonb;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    return pg_catalog.jsonb_build_object('error', 'unauthorized');
  end if;
  select * into v_grant from public.nutrition_ai_grants
    where token_hash = p_token_hash and revoked_at is null;
  if not found then return pg_catalog.jsonb_build_object('error', 'unauthorized'); end if;
  if not (v_grant.scopes && array['nutrition:summary', 'nutrition:history']::text[]) then
    return pg_catalog.jsonb_build_object('error', 'unauthorized');
  end if;
  update public.nutrition_ai_grants set last_access_at = pg_catalog.now() where id = v_grant.id;
  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'diary_date', e.diary_date, 'meal_label', e.meal_label, 'items', (
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'name', i.name, 'quantity', i.quantity, 'unit', i.unit,
        'calories', i.calories, 'protein_g', i.protein_g, 'carbs_g', i.carbs_g, 'fat_g', i.fat_g
      ) order by i.position)
      from public.nutrition_items i where i.entry_id = e.id and i.owner_id = v_grant.owner_id
    )
  )) into v_meals
  from public.nutrition_entries e
  where e.owner_id = v_grant.owner_id and (p_diary_date is null or e.diary_date = p_diary_date);
  return pg_catalog.jsonb_build_object('owner_id', v_grant.owner_id, 'meals', coalesce(v_meals, '[]'::jsonb));
end $$;
revoke all on function public.read_nutrition_for_grant(text, date) from public, anon, authenticated, service_role;

comment on table public.nutrition_ai_grants is
  'Disabled read-only assistant grants. Scopes are nutrition summary, history, trends, and saved meals. No finance, pharmacy, modify, or delete. read_nutrition_for_grant is revoked.';

comment on table public.nutrition_entries is
  'Private meal diary. diary_date is the 5 AM America/Chicago game day. Logging awards 0 XP. Photos are not stored.';

notify pgrst, 'reload schema';
