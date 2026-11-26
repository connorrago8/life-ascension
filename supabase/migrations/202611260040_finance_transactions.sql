-- Owner-only finance transactions. TEST project njqwwimzrsunheehnnnt only.
-- Do not apply to production ugcvhmrriazbbymjxvch.
--
-- This is the only finance table that stores an amount. Payday checks, follow-ups,
-- quests, companion rows, shared cards, and badges stay free of money columns.
-- Amounts are readable by the row owner. A second account, including Izzy, gets
-- no rows. Companion, shared-card, badge, and MCP functions are not granted here.
--
-- CSV overlaps dedupe on the content hash (source csv). Monarch pulls upsert on
-- (owner, source, external id), so a pending row becomes the posted row in place.
-- Replaying the same import id returns the stored result and does not verify again.
-- A match completes through the existing quest completion path and pays once.
-- A mismatch writes a private needs_review flag. It does not fail a quest.
--
-- Reverse with supabase/rollbacks/202611260040_finance_transactions_down.sql.
-- The down file drops these new tables only. It does not delete quests or xp_ledger.

create table public.finance_transactions (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('csv', 'monarch_mcp')),
  external_id text not null check (char_length(external_id) between 1 and 200),
  posted_on date not null check (posted_on >= date '2000-01-01'),
  merchant text not null check (char_length(merchant) between 1 and 200),
  category text not null check (char_length(category) between 1 and 120),
  account_label text not null check (char_length(account_label) between 1 and 120),
  amount numeric(14,2) not null check (amount > -100000000 and amount < 100000000),
  row_hash text not null check (row_hash ~ '^[0-9a-f]{64}$'),
  import_id uuid not null,
  pending boolean not null default false,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint finance_transactions_source_external unique (owner_id, source, external_id)
);

create unique index finance_transactions_csv_hash
  on public.finance_transactions (owner_id, row_hash)
  where source = 'csv';

create index finance_transactions_owner_day
  on public.finance_transactions (owner_id, posted_on);

create table public.finance_import_log (
  owner_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  source text not null check (source in ('csv', 'monarch_mcp')),
  inserted_count integer not null check (inserted_count >= 0),
  updated_count integer not null check (updated_count >= 0),
  unchanged_count integer not null check (unchanged_count >= 0),
  verification jsonb not null,
  verify_count integer not null default 1 check (verify_count >= 1),
  created_at timestamptz not null default pg_catalog.now(),
  primary key (owner_id, request_id)
);

create index finance_import_log_owner_recent
  on public.finance_import_log (owner_id, created_at desc);

create table public.finance_ingest_tokens (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  token_prefix text not null check (char_length(token_prefix) between 8 and 24),
  created_at timestamptz not null default pg_catalog.now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create unique index finance_ingest_one_active
  on public.finance_ingest_tokens (owner_id)
  where revoked_at is null;

create table public.finance_summary_views (
  owner_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  viewed_at timestamptz not null default pg_catalog.now(),
  primary key (owner_id, week_start)
);

create table public.finance_quest_flags (
  owner_id uuid not null references auth.users(id) on delete cascade,
  check_id text not null check (check_id in ('payment_posted', 'week_spending', 'no_spend_day')),
  state text not null check (state in ('matched', 'needs_review')),
  updated_at timestamptz not null default pg_catalog.now(),
  primary key (owner_id, check_id)
);

create table public.finance_no_spend_days (
  owner_id uuid not null references auth.users(id) on delete cascade,
  game_day date not null,
  quest_id uuid,
  instance_id uuid,
  xp_awarded integer not null default 0 check (xp_awarded >= 0),
  created_at timestamptz not null default pg_catalog.now(),
  primary key (owner_id, game_day)
);

alter table public.finance_transactions enable row level security;
alter table public.finance_import_log enable row level security;
alter table public.finance_ingest_tokens enable row level security;
alter table public.finance_summary_views enable row level security;
alter table public.finance_quest_flags enable row level security;
alter table public.finance_no_spend_days enable row level security;
alter table public.finance_transactions force row level security;
alter table public.finance_import_log force row level security;
alter table public.finance_ingest_tokens force row level security;
alter table public.finance_summary_views force row level security;
alter table public.finance_quest_flags force row level security;
alter table public.finance_no_spend_days force row level security;

revoke all on public.finance_transactions, public.finance_import_log, public.finance_ingest_tokens,
  public.finance_summary_views, public.finance_quest_flags, public.finance_no_spend_days
  from public, anon, authenticated;

grant select on public.finance_transactions, public.finance_import_log, public.finance_summary_views,
  public.finance_quest_flags, public.finance_no_spend_days to authenticated;
grant select (id, owner_id, token_prefix, created_at, last_used_at, revoked_at)
  on public.finance_ingest_tokens to authenticated;

create policy finance_transactions_owner_read on public.finance_transactions
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy finance_import_log_owner_read on public.finance_import_log
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy finance_ingest_tokens_owner_read on public.finance_ingest_tokens
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy finance_summary_views_owner_read on public.finance_summary_views
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy finance_quest_flags_owner_read on public.finance_quest_flags
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy finance_no_spend_owner_read on public.finance_no_spend_days
  for select to authenticated using ((select auth.uid()) = owner_id);

create or replace view public.finance_ingest_tokens_safe
with (security_barrier = true, security_invoker = true) as
select id, owner_id, token_prefix, created_at, last_used_at, revoked_at
from public.finance_ingest_tokens
where owner_id = (select auth.uid());
revoke all on public.finance_ingest_tokens_safe from public, anon, authenticated;
grant select on public.finance_ingest_tokens_safe to authenticated;

create or replace function public.finance_caller_is_companion()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.companion_bonds
    where companion_id = (select auth.uid()) and status = 'active'
  )
$$;
revoke all on function public.finance_caller_is_companion() from public, anon, authenticated;

create or replace function public.finance_mask_account(p_label text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text := pg_catalog.left(pg_catalog.btrim(coalesce(p_label, '')), 120);
  i integer := 1;
  n integer;
  start_at integer;
  digits text;
  ch text;
  out text := '';
begin
  if v = '' then
    return 'Account';
  end if;
  n := pg_catalog.char_length(v);
  while i <= n loop
    ch := pg_catalog.substr(v, i, 1);
    if ch ~ '[0-9]' then
      start_at := i;
      digits := '';
      while i <= n loop
        ch := pg_catalog.substr(v, i, 1);
        if ch ~ '[0-9]' then
          digits := digits || ch;
          i := i + 1;
        elsif (ch = ' ' or ch = '-') and i < n
          and pg_catalog.substr(v, i + 1, 1) ~ '[0-9]'
          and pg_catalog.char_length(digits) > 0 then
          i := i + 1;
        else
          exit;
        end if;
      end loop;
      if pg_catalog.char_length(digits) >= 6 then
        out := out || '••••' || pg_catalog.right(digits, 4);
      else
        out := out || pg_catalog.substr(v, start_at, i - start_at);
      end if;
    else
      out := out || ch;
      i := i + 1;
    end if;
  end loop;
  return pg_catalog.left(out, 120);
end
$$;
revoke all on function public.finance_mask_account(text) from public, anon, authenticated;

create or replace function public.finance_content_hash(
  p_source text,
  p_external_id text,
  p_date date,
  p_merchant text,
  p_category text,
  p_account text,
  p_amount numeric,
  p_pending boolean
) returns text
language sql
immutable
set search_path = ''
as $$
  select encode(extensions.digest(pg_catalog.convert_to(
    coalesce(p_source, '') || '|' ||
    coalesce(p_external_id, '') || '|' ||
    to_char(p_date, 'YYYY-MM-DD') || '|' ||
    pg_catalog.lower(pg_catalog.btrim(coalesce(p_merchant, ''))) || '|' ||
    pg_catalog.lower(pg_catalog.btrim(coalesce(p_category, ''))) || '|' ||
    pg_catalog.lower(pg_catalog.btrim(coalesce(p_account, ''))) || '|' ||
    pg_catalog.btrim(pg_catalog.to_char(p_amount, '999999990.00')) || '|' ||
    case when p_pending then '1' else '0' end,
    'UTF8'), 'sha256'), 'hex')
$$;
revoke all on function public.finance_content_hash(text, text, date, text, text, text, numeric, boolean)
  from public, anon, authenticated;

create or replace function public._finance_flag(p_owner uuid, p_check text, p_state text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is distinct from p_owner then
    raise exception 'Sign-in required';
  end if;
  if p_state not in ('matched', 'needs_review') then
    return;
  end if;
  insert into public.finance_quest_flags (owner_id, check_id, state)
  values (p_owner, p_check, p_state)
  on conflict (owner_id, check_id) do update
    set state = excluded.state, updated_at = pg_catalog.now();
end
$$;
revoke all on function public._finance_flag(uuid, text, text) from public, anon, authenticated;

create or replace function public._finance_complete_template(p_template text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_row public.track_template_states%rowtype;
  v_started jsonb;
  v_done jsonb;
begin
  if v_owner is null then raise exception 'Sign-in required'; end if;
  if p_template not in ('payment_posted', 'week_spending') then
    raise exception 'Invalid finance import' using errcode = '22023';
  end if;
  select * into v_row from public.track_template_states
    where owner_id = v_owner and track = 'finance' and template_id = p_template;
  if found and v_row.status = 'complete' then
    return pg_catalog.jsonb_build_object('status', 'matched', 'xp_awarded', 0, 'already', true);
  end if;
  if found and v_row.status = 'skipped' then
    return pg_catalog.jsonb_build_object('status', 'skipped', 'xp_awarded', 0, 'already', true);
  end if;
  if not found then
    v_started := public.start_track_template('finance', p_template, pg_catalog.gen_random_uuid());
    if coalesce(v_started->>'status', '') <> 'in_progress' then
      return pg_catalog.jsonb_build_object('status', 'unchanged', 'xp_awarded', 0, 'already', true);
    end if;
  end if;
  v_done := public.complete_track_template('finance', p_template, pg_catalog.gen_random_uuid());
  return pg_catalog.jsonb_build_object(
    'status', 'matched',
    'xp_awarded', coalesce((v_done->>'xp_awarded')::integer, 0),
    'already', coalesce((v_done->>'already')::boolean, false)
  );
end
$$;
revoke all on function public._finance_complete_template(text) from public, anon, authenticated;

create or replace function public._finance_complete_no_spend(p_day date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_existing public.finance_no_spend_days%rowtype;
  v_quest uuid;
  v_instance uuid;
  v_award jsonb;
  v_xp integer := 0;
begin
  if v_owner is null or p_day is null then raise exception 'Sign-in required'; end if;
  select * into v_existing from public.finance_no_spend_days
    where owner_id = v_owner and game_day = p_day;
  if found then
    return pg_catalog.jsonb_build_object('status', 'matched', 'xp_awarded', 0, 'already', true);
  end if;
  insert into public.quests (owner_id, title, domain, cadence, scheduled_for, quest_type, description)
  values (
    v_owner, 'No-Spend Day', 'finance', 'once', p_day, 'scheduled',
    'Checked from the owner finance import.'
  )
  returning id into v_quest;
  insert into public.quest_instances (owner_id, quest_id, due_date)
  values (v_owner, v_quest, p_day)
  returning id into v_instance;
  v_award := public.set_quest_instance_status_v2(v_instance, 'complete');
  v_xp := coalesce((v_award->>'xp_awarded')::integer, 0);
  insert into public.finance_no_spend_days (owner_id, game_day, quest_id, instance_id, xp_awarded)
  values (v_owner, p_day, v_quest, v_instance, v_xp);
  return pg_catalog.jsonb_build_object('status', 'matched', 'xp_awarded', v_xp, 'already', false);
end
$$;
revoke all on function public._finance_complete_no_spend(date) from public, anon, authenticated;

create or replace function public._finance_verify_money(p_owner uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date;
  v_week date;
  v_match boolean;
  v_window boolean;
  v_week_rows boolean;
  v_viewed boolean;
  v_day boolean;
  v_spend boolean;
  v_payment jsonb;
  v_week_result jsonb;
  v_no_spend jsonb;
begin
  if auth.uid() is distinct from p_owner then raise exception 'Sign-in required'; end if;
  if public.finance_caller_is_companion() then
    raise exception 'Finance import is owner-only' using errcode = '42501';
  end if;
  v_today := public.quest_today();
  v_week := public.quest_week_start(v_today);

  v_match := exists (
    select 1 from public.finance_transactions
    where owner_id = p_owner and pending = false
      and posted_on between v_week and v_today
      and (category ~* 'payment' or (category ~* 'transfer' and amount < 0))
  );
  v_window := exists (
    select 1 from public.finance_transactions
    where owner_id = p_owner and posted_on between v_week and v_today
  );
  if v_match then
    v_payment := public._finance_complete_template('payment_posted');
    perform public._finance_flag(p_owner, 'payment_posted', 'matched');
  elsif v_window then
    v_payment := pg_catalog.jsonb_build_object('status', 'needs_review', 'xp_awarded', 0, 'already', false);
    perform public._finance_flag(p_owner, 'payment_posted', 'needs_review');
  else
    v_payment := pg_catalog.jsonb_build_object('status', 'unchanged', 'xp_awarded', 0, 'already', false);
  end if;

  v_week_rows := exists (
    select 1 from public.finance_transactions
    where owner_id = p_owner and pending = false and posted_on between v_week and v_today
  );
  v_viewed := exists (
    select 1 from public.finance_summary_views
    where owner_id = p_owner and week_start = v_week
  );
  if v_week_rows and v_viewed then
    v_week_result := public._finance_complete_template('week_spending');
    perform public._finance_flag(p_owner, 'week_spending', 'matched');
  elsif v_viewed then
    v_week_result := pg_catalog.jsonb_build_object('status', 'needs_review', 'xp_awarded', 0, 'already', false);
    perform public._finance_flag(p_owner, 'week_spending', 'needs_review');
  else
    v_week_result := pg_catalog.jsonb_build_object('status', 'waiting', 'xp_awarded', 0, 'already', false);
  end if;

  v_day := exists (
    select 1 from public.finance_transactions
    where owner_id = p_owner and pending = false and posted_on = v_today
  );
  v_spend := exists (
    select 1 from public.finance_transactions
    where owner_id = p_owner and pending = false and posted_on = v_today
      and amount < 0 and category !~* 'transfer'
  );
  if v_day and not v_spend then
    v_no_spend := public._finance_complete_no_spend(v_today);
    perform public._finance_flag(p_owner, 'no_spend_day', 'matched');
  elsif v_day and v_spend then
    v_no_spend := pg_catalog.jsonb_build_object('status', 'needs_review', 'xp_awarded', 0, 'already', false);
    perform public._finance_flag(p_owner, 'no_spend_day', 'needs_review');
  else
    v_no_spend := pg_catalog.jsonb_build_object('status', 'unchanged', 'xp_awarded', 0, 'already', false);
  end if;

  return pg_catalog.jsonb_build_object(
    'payment_posted', v_payment,
    'week_spending', v_week_result,
    'no_spend_day', v_no_spend
  );
end
$$;
revoke all on function public._finance_verify_money(uuid) from public, anon, authenticated;

create or replace function public._finance_import(
  p_owner uuid,
  p_source text,
  p_request_id uuid,
  p_rows jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.finance_import_log%rowtype;
  v_item jsonb;
  v_external text;
  v_monarch_id text;
  v_date_text text;
  v_date date;
  v_merchant text;
  v_category text;
  v_account text;
  v_amount_text text;
  v_amount numeric(14,2);
  v_pending boolean;
  v_hash text;
  v_inserted boolean;
  v_now timestamptz;
  v_inserts integer := 0;
  v_updates integer := 0;
  v_same integer := 0;
  v_today date;
  v_verification jsonb;
  v_result jsonb;
begin
  if auth.uid() is distinct from p_owner then raise exception 'Sign-in required'; end if;
  if public.finance_caller_is_companion() then
    raise exception 'Finance import is owner-only' using errcode = '42501';
  end if;
  if p_request_id is null or p_source not in ('csv', 'monarch_mcp')
     or p_rows is null or pg_catalog.jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Invalid finance import' using errcode = '22023';
  end if;
  if pg_catalog.jsonb_array_length(p_rows) > 2000 or pg_catalog.octet_length(p_rows::text) > 1500000 then
    raise exception 'Too many transactions' using errcode = '54000';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('finance-import:' || p_owner::text, 0));
  select * into v_existing from public.finance_import_log
    where owner_id = p_owner and request_id = p_request_id;
  if found then
    return pg_catalog.jsonb_build_object(
      'ok', true, 'replayed', true, 'request_id', p_request_id,
      'inserted', v_existing.inserted_count, 'updated', v_existing.updated_count,
      'unchanged', v_existing.unchanged_count, 'verification', v_existing.verification
    );
  end if;
  if (
    select count(*) from public.finance_import_log
    where owner_id = p_owner and created_at > pg_catalog.now() - interval '1 hour'
  ) >= 30 then
    raise exception 'Too many finance imports' using errcode = '53300';
  end if;

  v_today := public.quest_today();
  for v_item in select value from pg_catalog.jsonb_array_elements(p_rows) loop
    if pg_catalog.jsonb_typeof(v_item) <> 'object' then
      raise exception 'Invalid finance import' using errcode = '22023';
    end if;
    v_date_text := pg_catalog.btrim(coalesce(v_item->>'date', ''));
    v_merchant := pg_catalog.left(pg_catalog.regexp_replace(pg_catalog.btrim(coalesce(v_item->>'merchant', '')), '[[:cntrl:]]', '', 'g'), 200);
    v_category := pg_catalog.left(pg_catalog.regexp_replace(pg_catalog.btrim(coalesce(v_item->>'category', '')), '[[:cntrl:]]', '', 'g'), 120);
    v_account := public.finance_mask_account(v_item->>'account_label');
    v_amount_text := pg_catalog.btrim(coalesce(v_item->>'amount', ''));
    v_monarch_id := pg_catalog.left(pg_catalog.regexp_replace(pg_catalog.btrim(coalesce(v_item->>'id', '')), '[[:cntrl:]]', '', 'g'), 200);
    if v_merchant = '' then v_merchant := 'Unknown'; end if;
    if v_category = '' then v_category := 'Uncategorized'; end if;
    if v_date_text !~ '^\d{4}-\d{2}-\d{2}$' or v_amount_text !~ '^-?\d+(\.\d+)?$' then
      raise exception 'Invalid finance import' using errcode = '22023';
    end if;
    begin
      v_date := v_date_text::date;
    exception when others then
      raise exception 'Invalid finance import' using errcode = '22023';
    end;
    if v_date < date '2000-01-01' or v_date > v_today + 2 then
      raise exception 'Invalid finance import' using errcode = '22023';
    end if;
    v_amount := pg_catalog.round(v_amount_text::numeric, 2);
    if v_amount <= -100000000 or v_amount >= 100000000 then
      raise exception 'Invalid finance import' using errcode = '22023';
    end if;
    if p_source = 'csv' then
      v_pending := false;
      v_hash := public.finance_content_hash('csv', '', v_date, v_merchant, v_category, v_account, v_amount, false);
      v_external := v_hash;
    else
      if v_monarch_id is null or char_length(v_monarch_id) < 1 then
        raise exception 'Invalid finance import' using errcode = '22023';
      end if;
      if v_item ? 'pending' and pg_catalog.jsonb_typeof(v_item->'pending') <> 'boolean' then
        raise exception 'Invalid finance import' using errcode = '22023';
      end if;
      v_pending := coalesce((v_item->>'pending')::boolean, false);
      v_external := v_monarch_id;
      v_hash := public.finance_content_hash('monarch_mcp', v_external, v_date, v_merchant, v_category, v_account, v_amount, v_pending);
    end if;

    v_now := pg_catalog.clock_timestamp();
    with up as (
      insert into public.finance_transactions (
        owner_id, source, external_id, posted_on, merchant, category, account_label,
        amount, row_hash, import_id, pending, created_at, updated_at
      ) values (
        p_owner, p_source, v_external, v_date, v_merchant, v_category, v_account,
        v_amount, v_hash, p_request_id, v_pending, v_now, v_now
      )
      on conflict (owner_id, source, external_id) do update set
        posted_on = excluded.posted_on,
        merchant = excluded.merchant,
        category = excluded.category,
        account_label = excluded.account_label,
        amount = excluded.amount,
        row_hash = excluded.row_hash,
        import_id = excluded.import_id,
        pending = excluded.pending,
        updated_at = pg_catalog.clock_timestamp()
      where public.finance_transactions.posted_on is distinct from excluded.posted_on
         or public.finance_transactions.merchant is distinct from excluded.merchant
         or public.finance_transactions.category is distinct from excluded.category
         or public.finance_transactions.account_label is distinct from excluded.account_label
         or public.finance_transactions.amount is distinct from excluded.amount
         or public.finance_transactions.row_hash is distinct from excluded.row_hash
         or public.finance_transactions.pending is distinct from excluded.pending
      returning (created_at = updated_at) as inserted
    )
    select up.inserted into v_inserted from up;
    if not found then
      v_same := v_same + 1;
    elsif v_inserted then
      v_inserts := v_inserts + 1;
    else
      v_updates := v_updates + 1;
    end if;
  end loop;

  v_verification := public._finance_verify_money(p_owner);
  insert into public.finance_import_log (
    owner_id, request_id, source, inserted_count, updated_count, unchanged_count, verification, verify_count
  ) values (
    p_owner, p_request_id, p_source, v_inserts, v_updates, v_same, v_verification, 1
  );
  v_result := pg_catalog.jsonb_build_object(
    'ok', true, 'replayed', false, 'request_id', p_request_id,
    'inserted', v_inserts, 'updated', v_updates, 'unchanged', v_same,
    'verification', v_verification
  );
  return v_result;
end
$$;
revoke all on function public._finance_import(uuid, text, uuid, jsonb) from public, anon, authenticated;

create or replace function public.import_finance_csv(p_import_id uuid, p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
begin
  if v_owner is null then raise exception 'Sign-in required'; end if;
  return public._finance_import(v_owner, 'csv', p_import_id, p_rows);
end
$$;
revoke all on function public.import_finance_csv(uuid, jsonb) from public, anon;
grant execute on function public.import_finance_csv(uuid, jsonb) to authenticated;

create or replace function public.import_monarch_transactions(
  p_token_hash text,
  p_request_id uuid,
  p_rows jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_revoked timestamptz;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid or revoked finance token' using errcode = '28000';
  end if;
  select owner_id, revoked_at into v_owner, v_revoked
  from public.finance_ingest_tokens
  where token_hash = p_token_hash;
  if v_owner is null or v_revoked is not null then
    raise exception 'Invalid or revoked finance token' using errcode = '28000';
  end if;
  perform pg_catalog.set_config('request.jwt.claim.sub', v_owner::text, true);
  perform pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
  update public.finance_ingest_tokens
    set last_used_at = pg_catalog.now()
    where token_hash = p_token_hash and owner_id = v_owner;
  return public._finance_import(v_owner, 'monarch_mcp', p_request_id, p_rows);
end
$$;
revoke all on function public.import_monarch_transactions(text, uuid, jsonb) from public, authenticated;
grant execute on function public.import_monarch_transactions(text, uuid, jsonb) to anon;

create or replace function public._finance_issue_token(p_rotate boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_raw text;
  v_hash text;
  v_prefix text;
  v_id uuid;
  v_active integer;
begin
  if v_owner is null then raise exception 'Sign-in required'; end if;
  if public.finance_caller_is_companion() then
    raise exception 'Finance import is owner-only' using errcode = '42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('finance-token:' || v_owner::text, 0));
  select count(*) into v_active from public.finance_ingest_tokens
    where owner_id = v_owner and revoked_at is null;
  if v_active > 0 and not p_rotate then
    raise exception 'Rotate the finance token first' using errcode = '22023';
  end if;
  if p_rotate then
    update public.finance_ingest_tokens
      set revoked_at = pg_catalog.now()
      where owner_id = v_owner and revoked_at is null;
  end if;
  v_raw := 'la_fin_' || pg_catalog.replace(pg_catalog.gen_random_uuid()::text || pg_catalog.gen_random_uuid()::text, '-', '');
  v_hash := encode(extensions.digest(pg_catalog.convert_to(v_raw, 'UTF8'), 'sha256'), 'hex');
  v_prefix := pg_catalog.left(v_raw, 16);
  insert into public.finance_ingest_tokens (owner_id, token_hash, token_prefix)
  values (v_owner, v_hash, v_prefix)
  returning id into v_id;
  return pg_catalog.jsonb_build_object('ok', true, 'id', v_id, 'token', v_raw, 'prefix', v_prefix);
end
$$;
revoke all on function public._finance_issue_token(boolean) from public, anon, authenticated;

create or replace function public.finance_ingest_token_create()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  return public._finance_issue_token(false);
end
$$;
revoke all on function public.finance_ingest_token_create() from public, anon;
grant execute on function public.finance_ingest_token_create() to authenticated;

create or replace function public.finance_ingest_token_rotate()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  return public._finance_issue_token(true);
end
$$;
revoke all on function public.finance_ingest_token_rotate() from public, anon;
grant execute on function public.finance_ingest_token_rotate() to authenticated;

create or replace function public.finance_ingest_token_revoke()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_count integer;
begin
  if v_owner is null then raise exception 'Sign-in required'; end if;
  if public.finance_caller_is_companion() then
    raise exception 'Finance import is owner-only' using errcode = '42501';
  end if;
  update public.finance_ingest_tokens
    set revoked_at = pg_catalog.now()
    where owner_id = v_owner and revoked_at is null;
  get diagnostics v_count = row_count;
  return pg_catalog.jsonb_build_object('ok', true, 'revoked', v_count);
end
$$;
revoke all on function public.finance_ingest_token_revoke() from public, anon;
grant execute on function public.finance_ingest_token_revoke() to authenticated;

create or replace function public.finance_week_summary()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_today date;
  v_week date;
  v_categories jsonb;
  v_merchants jsonb;
  v_count integer;
  v_checks jsonb;
begin
  if v_owner is null then raise exception 'Sign-in required'; end if;
  if public.finance_caller_is_companion() then
    return pg_catalog.jsonb_build_object(
      'owner', false, 'row_count', 0,
      'categories', '[]'::jsonb, 'merchants', '[]'::jsonb,
      'checks', '{}'::jsonb
    );
  end if;
  v_today := public.quest_today();
  v_week := public.quest_week_start(v_today);
  insert into public.finance_summary_views (owner_id, week_start)
  values (v_owner, v_week)
  on conflict (owner_id, week_start) do nothing;
  v_checks := public._finance_verify_money(v_owner);
  select count(*) into v_count from public.finance_transactions
    where owner_id = v_owner and pending = false and posted_on between v_week and v_today;
  select coalesce(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object('category', category, 'spent', spent) order by spent_value desc
  ), '[]'::jsonb) into v_categories
  from (
    select category,
      pg_catalog.btrim(pg_catalog.to_char(pg_catalog.round(sum(-amount), 2), '999999990.00')) as spent,
      sum(-amount) as spent_value
    from public.finance_transactions
    where owner_id = v_owner and pending = false and posted_on between v_week and v_today
      and amount < 0 and category !~* 'transfer'
    group by category
  ) c;
  select coalesce(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object('merchant', merchant, 'spent', spent) order by spent_value desc
  ), '[]'::jsonb) into v_merchants
  from (
    select merchant,
      pg_catalog.btrim(pg_catalog.to_char(pg_catalog.round(sum(-amount), 2), '999999990.00')) as spent,
      sum(-amount) as spent_value
    from public.finance_transactions
    where owner_id = v_owner and pending = false and posted_on between v_week and v_today
      and amount < 0 and category !~* 'transfer'
    group by merchant
    order by sum(-amount) desc
    limit 5
  ) m;
  return pg_catalog.jsonb_build_object(
    'owner', true,
    'week_start', v_week,
    'week_end', v_today,
    'row_count', v_count,
    'categories', v_categories,
    'merchants', v_merchants,
    'checks', v_checks
  );
end
$$;
revoke all on function public.finance_week_summary() from public, anon;
grant execute on function public.finance_week_summary() to authenticated;

comment on table public.finance_transactions is
  'Owner-only transaction register. The only finance table with an amount. Not for Izzy, shared cards, badges, or MCP.';

notify pgrst, 'reload schema';
