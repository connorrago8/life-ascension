-- TEST-only engagement: web push subscriptions, per-account notification
-- preferences, an outbox the quest RPCs cannot fail, and revocable widget tokens.
-- Reverse with supabase/rollbacks/202611140001_engagement_pwa_push_down.sql.
-- Does not change XP, Crypt, Wear, or existing quest function bodies.
-- Quiet hours default 22:00–07:00 in the account quest time zone (America/Chicago
-- when none is stored). Sends are idempotent per recipient, kind, and game day.
-- Daily progress may send again only when that person's own snapshot changes,
-- and the client replaces the notification via tag daily-progress.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.engagement_config (
  id integer primary key check (id = 1),
  cron_secret_hash text
);
insert into private.engagement_config (id) values (1) on conflict (id) do nothing;
revoke all on table private.engagement_config from public, anon, authenticated;

create table if not exists public.push_subscriptions (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique check (endpoint like 'https://%' and char_length(endpoint) between 12 and 2000),
  keys jsonb not null,
  user_agent text,
  created_at timestamptz not null default pg_catalog.now(),
  last_success_at timestamptz,
  disabled_at timestamptz,
  constraint push_subscriptions_keys_shape check (
    jsonb_typeof(keys) = 'object'
    and char_length(keys->>'p256dh') between 16 and 200
    and char_length(keys->>'auth') between 8 and 200
  )
);
create index if not exists push_subscriptions_user_active_idx
  on public.push_subscriptions (user_id) where disabled_at is null;

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  partner_assigned boolean not null default true,
  partner_completed boolean not null default true,
  streak_at_risk boolean not null default true,
  daily_progress boolean not null default true,
  quiet_start time not null default '22:00',
  quiet_end time not null default '07:00',
  updated_at timestamptz not null default pg_catalog.now(),
  constraint notification_preferences_quiet_start_check check (quiet_start is not null),
  constraint notification_preferences_quiet_end_check check (quiet_end is not null)
);

create table if not exists public.push_outbox (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('partner_assigned', 'partner_completed', 'streak_at_risk', 'daily_progress')),
  game_day date not null,
  dedupe_key text not null,
  title text not null,
  body text not null,
  url text not null,
  tag text not null,
  created_at timestamptz not null default pg_catalog.now(),
  claimed_at timestamptz,
  sent_at timestamptz,
  skip_reason text,
  unique (recipient_id, kind, game_day, dedupe_key)
);
create index if not exists push_outbox_pending_idx
  on public.push_outbox (created_at) where sent_at is null;

create table if not exists public.push_deliveries (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  game_day date not null,
  dedupe_key text not null,
  created_at timestamptz not null default pg_catalog.now(),
  primary key (user_id, kind, game_day, dedupe_key)
);

create table if not exists public.widget_tokens (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  token_prefix text not null check (char_length(token_prefix) between 8 and 24),
  created_at timestamptz not null default pg_catalog.now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

alter table public.push_subscriptions enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.push_outbox enable row level security;
alter table public.push_deliveries enable row level security;
drop policy if exists push_deliveries_none on public.push_deliveries;
create policy push_deliveries_none on public.push_deliveries
  for select to authenticated
  using (false);
alter table public.widget_tokens enable row level security;

drop policy if exists push_subscriptions_select on public.push_subscriptions;
create policy push_subscriptions_select on public.push_subscriptions
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists notification_preferences_own on public.notification_preferences;
create policy notification_preferences_own on public.notification_preferences
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists push_outbox_actor_select on public.push_outbox;
create policy push_outbox_actor_select on public.push_outbox
  for select to authenticated
  using (actor_id = (select auth.uid()));

drop policy if exists widget_tokens_select on public.widget_tokens;
create policy widget_tokens_select on public.widget_tokens
  for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.push_subscriptions, public.notification_preferences, public.push_outbox,
  public.push_deliveries, public.widget_tokens from public, anon, authenticated;
grant select (id, user_id, endpoint, user_agent, created_at, last_success_at, disabled_at)
  on public.push_subscriptions to authenticated;
grant select, insert, update on public.notification_preferences to authenticated;
grant select on public.push_outbox to authenticated;
grant select (id, user_id, token_prefix, created_at, last_used_at, revoked_at)
  on public.widget_tokens to authenticated;

create or replace view public.widget_tokens_safe
with (security_barrier = true, security_invoker = true) as
select id, user_id, token_prefix, created_at, last_used_at, revoked_at
from public.widget_tokens
where user_id = (select auth.uid());
revoke all on public.widget_tokens_safe from public, anon, authenticated;
grant select on public.widget_tokens_safe to authenticated;

-- Internal helpers. Not granted to API roles.

create or replace function public.engagement_cron_ok(p_hash text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_stored text;
begin
  if p_hash is null or char_length(p_hash) <> 64 or p_hash !~ '^[0-9a-f]{64}$' then
    return false;
  end if;
  select cron_secret_hash into v_stored from private.engagement_config where id = 1;
  if v_stored is null or char_length(v_stored) <> 64 then return false; end if;
  return v_stored = lower(p_hash);
end $$;
revoke all on function public.engagement_cron_ok(text) from public, anon, authenticated, service_role;

create or replace function public.engagement_quests_path(p_owner uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (
      select 1 from public.companion_bonds
      where status = 'active' and companion_id = p_owner
    ) then '/companion/quests'
    else '/quests'
  end
$$;
revoke all on function public.engagement_quests_path(uuid) from public, anon, authenticated, service_role;

create or replace function public.engagement_own_status(p_owner uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz text;
  v_today date;
  v_done integer;
  v_left integer;
  v_xp bigint;
  v_level integer;
  v_base bigint;
  v_companion boolean;
begin
  if p_owner is null then return null; end if;
  v_tz := public.quest_timezone(p_owner);
  v_today := public.quest_game_day(pg_catalog.now(), v_tz);
  select count(*) into v_done
    from public.quest_instances i
    join public.quests q on q.id = i.quest_id and q.owner_id = i.owner_id
   where i.owner_id = p_owner and i.status = 'completed' and i.due_date = v_today;
  select count(*) into v_left
    from public.quest_instances i
    join public.quests q on q.id = i.quest_id and q.owner_id = i.owner_id
   where i.owner_id = p_owner and q.active and i.status = 'available' and i.due_date = v_today;
  v_companion := exists (
    select 1 from public.companion_bonds
    where status = 'active' and companion_id = p_owner
  );
  if v_companion then
    v_xp := public._companion_lifetime_xp(p_owner);
  else
    v_xp := (
      coalesce((select sum(amount) from public.xp_ledger where owner_id = p_owner), 0)
      + coalesce((select sum(amount) from public.xp_ledger_adjustments where owner_id = p_owner), 0)
    )::bigint;
  end if;
  v_level := public.level_for_xp(v_xp);
  if v_level <= 1 then v_base := 0;
  else v_base := (5 * ((v_level::bigint * (v_level + 1) - 2) / 2));
  end if;
  return pg_catalog.jsonb_build_object(
    'gameDay', v_today,
    'completed', v_done,
    'total', v_done + v_left,
    'remaining', v_left,
    'streak', public.quest_streak_fire(p_owner, v_today, v_tz),
    'doneToday', public.quest_has_completion_on(p_owner, v_today, v_tz),
    'level', v_level,
    'xpIntoLevel', greatest(v_xp - v_base, 0),
    'xpForNext', 5 * (v_level + 1),
    'lifetimeXp', v_xp,
    'timeZone', v_tz
  );
end $$;
revoke all on function public.engagement_own_status(uuid) from public, anon, authenticated, service_role;

create or replace function public.engagement_local_minutes(p_owner uuid, p_at timestamptz)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select (extract(hour from (p_at at time zone public.quest_timezone(p_owner)))::integer * 60)
       + extract(minute from (p_at at time zone public.quest_timezone(p_owner)))::integer
$$;
revoke all on function public.engagement_local_minutes(uuid, timestamptz) from public, anon, authenticated, service_role;

create or replace function public.engagement_is_quiet(p_owner uuid, p_at timestamptz)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_start integer := 22 * 60;
  v_end integer := 7 * 60;
  v_mins integer;
  v_pref public.notification_preferences%rowtype;
begin
  select * into v_pref from public.notification_preferences where user_id = p_owner;
  if found then
    v_start := extract(hour from v_pref.quiet_start)::integer * 60
      + extract(minute from v_pref.quiet_start)::integer;
    v_end := extract(hour from v_pref.quiet_end)::integer * 60
      + extract(minute from v_pref.quiet_end)::integer
  end if;
  if v_start = v_end then return false; end if;
  v_mins := public.engagement_local_minutes(p_owner, p_at);
  if v_start < v_end then return v_mins >= v_start and v_mins < v_end; end if;
  return v_mins >= v_start or v_mins < v_end;
end $$;
revoke all on function public.engagement_is_quiet(uuid, timestamptz) from public, anon, authenticated, service_role;

create or replace function public.engagement_kind_enabled(p_owner uuid, p_kind text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_pref public.notification_preferences%rowtype;
begin
  select * into v_pref from public.notification_preferences where user_id = p_owner;
  if not found then return true; end if;
  if p_kind = 'partner_assigned' then return v_pref.partner_assigned; end if;
  if p_kind = 'partner_completed' then return v_pref.partner_completed; end if;
  if p_kind = 'streak_at_risk' then return v_pref.streak_at_risk; end if;
  if p_kind = 'daily_progress' then return v_pref.daily_progress; end if;
  return false;
end $$;
revoke all on function public.engagement_kind_enabled(uuid, text) from public, anon, authenticated, service_role;

create or replace function public.engagement_enqueue_streak(p_owner uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tz text;
  v_today date;
  v_mins integer;
begin
  if p_owner is null then return; end if;
  if not public.engagement_kind_enabled(p_owner, 'streak_at_risk') then return; end if;
  if not exists (
    select 1 from public.push_subscriptions
    where user_id = p_owner and disabled_at is null
  ) then return; end if;
  v_tz := public.quest_timezone(p_owner);
  v_today := public.quest_game_day(pg_catalog.now(), v_tz);
  v_mins := public.engagement_local_minutes(p_owner, pg_catalog.now());
  -- 7:00 PM inclusive through 10:00 PM exclusive. Mirrors lib/push/quietHours.ts.
  if v_mins < 19 * 60 or v_mins >= 22 * 60 then return; end if;
  if public.engagement_is_quiet(p_owner, pg_catalog.now()) then return; end if;
  if public.quest_has_completion_on(p_owner, v_today, v_tz) then return; end if;
  if public.quest_streak_fire(p_owner, v_today, v_tz) <= 0 then return; end if;
  insert into public.push_outbox (
    recipient_id, actor_id, kind, game_day, dedupe_key, title, body, url, tag
  ) values (
    p_owner, p_owner, 'streak_at_risk', v_today, 'streak_at_risk',
    'Streak at risk',
    'No quest yet today. One completion keeps your streak.',
    public.engagement_quests_path(p_owner),
    'streak-at-risk'
  ) on conflict (recipient_id, kind, game_day, dedupe_key) do nothing;
end $$;
revoke all on function public.engagement_enqueue_streak(uuid) from public, anon, authenticated, service_role;

create or replace function public.engagement_clean_title(p_title text)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(nullif(left(pg_catalog.regexp_replace(coalesce(p_title, ''), '[[:cntrl:]]', '', 'g'), 80), ''), 'A quest')
$$;
revoke all on function public.engagement_clean_title(text) from public, anon, authenticated, service_role;

create or replace function public.engagement_on_companion_quest()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_title text; v_day date;
begin
  begin
    v_title := public.engagement_clean_title(new.title);
    if (tg_op = 'INSERT' and new.status in ('sent', 'accepted'))
       or (tg_op = 'UPDATE' and new.status in ('sent', 'accepted')
           and old.status is distinct from new.status
           and old.status not in ('sent', 'accepted')) then
      v_day := public.quest_game_day(pg_catalog.now(), public.quest_timezone(new.to_user));
      insert into public.push_outbox (
        recipient_id, actor_id, kind, game_day, dedupe_key, title, body, url, tag
      ) values (
        new.to_user, new.from_user, 'partner_assigned', v_day, 'partner_assigned',
        'A quest is waiting', 'New quest: ' || v_title,
        public.engagement_quests_path(new.to_user), 'partner-assigned'
      ) on conflict (recipient_id, kind, game_day, dedupe_key) do nothing;
    end if;
    if tg_op = 'UPDATE' and new.status = 'completed' and old.status = 'accepted' then
      v_day := public.quest_game_day(pg_catalog.now(), public.quest_timezone(new.from_user));
      insert into public.push_outbox (
        recipient_id, actor_id, kind, game_day, dedupe_key, title, body, url, tag
      ) values (
        new.from_user, new.to_user, 'partner_completed', v_day, 'partner_completed',
        'Quest completed', 'Completed: ' || v_title,
        public.engagement_quests_path(new.from_user), 'partner-completed'
      ) on conflict (recipient_id, kind, game_day, dedupe_key) do nothing;
    end if;
  exception when others then
    null;
  end;
  return new;
end $$;
revoke all on function public.engagement_on_companion_quest() from public, anon, authenticated, service_role;

drop trigger if exists engagement_companion_quest_push on public.companion_quests;
create trigger engagement_companion_quest_push
  after insert or update of status on public.companion_quests
  for each row execute function public.engagement_on_companion_quest();

create or replace function public.engagement_on_xp_award()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_day date;
begin
  begin
    if new.owner_id is null or coalesce(new.amount, 0) <= 0 then return new; end if;
    v_day := public.quest_game_day(pg_catalog.now(), public.quest_timezone(new.owner_id));
    insert into public.push_outbox (
      recipient_id, actor_id, kind, game_day, dedupe_key, title, body, url, tag
    ) values (
      new.owner_id, new.owner_id, 'daily_progress', v_day, 'daily_progress',
      'Today', 'Progress updated',
      public.engagement_quests_path(new.owner_id), 'daily-progress'
    )
    on conflict (recipient_id, kind, game_day, dedupe_key) do update
      set claimed_at = null, sent_at = null, skip_reason = null, created_at = pg_catalog.now()
      where public.push_outbox.sent_at is not null or public.push_outbox.skip_reason is not null;
  exception when others then
    null;
  end;
  return new;
end $$;
revoke all on function public.engagement_on_xp_award() from public, anon, authenticated, service_role;

drop trigger if exists engagement_xp_award_push on public.xp_ledger;
create trigger engagement_xp_award_push
  after insert on public.xp_ledger
  for each row execute function public.engagement_on_xp_award();

create or replace function public.push_subscribe(
  p_endpoint text, p_p256dh text, p_auth text, p_user_agent text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare u uuid := auth.uid(); v_id uuid;
begin
  if u is null then raise exception 'Sign-in required'; end if;
  if p_endpoint is null or p_endpoint !~ '^https://' or char_length(p_endpoint) not between 12 and 2000 then
    raise exception 'Invalid endpoint';
  end if;
  if p_p256dh is null or p_auth is null
     or char_length(p_p256dh) not between 16 and 200
     or char_length(p_auth) not between 8 and 200
     or p_p256dh !~ '^[A-Za-z0-9_-]+$'
     or p_auth !~ '^[A-Za-z0-9_-]+$' then
    raise exception 'Invalid subscription keys';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, keys, user_agent)
  values (
    u, p_endpoint,
    pg_catalog.jsonb_build_object('p256dh', p_p256dh, 'auth', p_auth),
    left(pg_catalog.regexp_replace(coalesce(p_user_agent, ''), '[[:cntrl:]]', '', 'g'), 200)
  )
  on conflict (endpoint) do update set
    user_id = excluded.user_id,
    keys = excluded.keys,
    user_agent = excluded.user_agent,
    disabled_at = null
  returning id into v_id;
  update public.push_subscriptions set disabled_at = pg_catalog.now()
  where id in (
    select id from public.push_subscriptions
    where user_id = u and disabled_at is null
    order by created_at desc
    offset 8
  );
  return pg_catalog.jsonb_build_object('ok', true, 'id', v_id);
end $$;
revoke all on function public.push_subscribe(text, text, text, text) from public, anon;
grant execute on function public.push_subscribe(text, text, text, text) to authenticated;

create or replace function public.push_unsubscribe(p_endpoint text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare u uuid := auth.uid(); v_count integer;
begin
  if u is null then raise exception 'Sign-in required'; end if;
  delete from public.push_subscriptions
  where user_id = u and endpoint = p_endpoint;
  get diagnostics v_count = row_count;
  return pg_catalog.jsonb_build_object('ok', true, 'removed', v_count);
end $$;
revoke all on function public.push_unsubscribe(text) from public, anon;
grant execute on function public.push_unsubscribe(text) to authenticated;

create or replace function public.push_claim(p_cron_hash text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cron boolean := false;
  v_actor uuid := auth.uid();
  r public.push_outbox%rowtype;
  v_status jsonb;
  v_mins integer;
  v_today date;
  v_dedupe text;
  v_title text;
  v_body text;
  v_url text;
  v_tag text;
  v_subs jsonb;
  v_items jsonb := '[]'::jsonb;
  v_held integer := 0;
  sub_owner record;
begin
  if p_cron_hash is not null then
    if (select cron_secret_hash from private.engagement_config where id = 1) is null then
      return pg_catalog.jsonb_build_object('ok', false, 'reason', 'unbound');
    end if;
    if not public.engagement_cron_ok(p_cron_hash) then
      return pg_catalog.jsonb_build_object('ok', false, 'reason', 'unauthorized');
    end if;
    v_cron := true;
  elsif v_actor is null then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'unauthorized');
  end if;

  if v_cron then
    for sub_owner in
      select distinct user_id from public.push_subscriptions where disabled_at is null limit 200
    loop
      perform public.engagement_enqueue_streak(sub_owner.user_id);
    end loop;
  else
    perform public.engagement_enqueue_streak(v_actor);
  end if;

  for r in
    select * from public.push_outbox
    where sent_at is null
      and (claimed_at is null or claimed_at < pg_catalog.now() - interval '2 minutes')
      and (v_cron or actor_id = v_actor)
    order by created_at
    limit 20
    for update skip locked
  loop
    v_today := public.quest_game_day(pg_catalog.now(), public.quest_timezone(r.recipient_id));
    v_mins := public.engagement_local_minutes(r.recipient_id, pg_catalog.now());
    if not public.engagement_kind_enabled(r.recipient_id, r.kind) then
      update public.push_outbox set sent_at = pg_catalog.now(), skip_reason = 'off' where id = r.id;
      continue;
    end if;
    if r.kind = 'streak_at_risk' and r.game_day < v_today then
      update public.push_outbox set sent_at = pg_catalog.now(), skip_reason = 'stale' where id = r.id;
      continue;
    end if;
    if r.kind <> 'streak_at_risk' and r.game_day < v_today - 1 then
      update public.push_outbox set sent_at = pg_catalog.now(), skip_reason = 'stale' where id = r.id;
      continue;
    end if;
    if r.kind = 'streak_at_risk' and v_mins >= 22 * 60 then
      update public.push_outbox set sent_at = pg_catalog.now(), skip_reason = 'window' where id = r.id;
      continue;
    end if;
    if r.kind = 'streak_at_risk' and (v_mins < 19 * 60 or public.engagement_is_quiet(r.recipient_id, pg_catalog.now())) then
      v_held := v_held + 1;
      continue;
    end if;
    if r.kind <> 'streak_at_risk' and public.engagement_is_quiet(r.recipient_id, pg_catalog.now()) then
      v_held := v_held + 1;
      continue;
    end if;

    v_title := r.title;
    v_body := r.body;
    v_url := r.url;
    v_tag := r.tag;
    v_dedupe := r.dedupe_key;
    if r.kind = 'daily_progress' then
      v_status := public.engagement_own_status(r.recipient_id);
      v_body := (v_status->>'completed') || '/' || (v_status->>'total')
        || ' quests · 🔥 ' || (v_status->>'streak')
        || ' · ' || (v_status->>'xpIntoLevel') || '/' || (v_status->>'xpForNext') || ' XP';
      v_dedupe := (v_status->>'completed') || '/' || (v_status->>'total') || '/'
        || (v_status->>'streak') || '/' || (v_status->>'xpIntoLevel') || '/' || (v_status->>'xpForNext');
      v_url := public.engagement_quests_path(r.recipient_id);
      v_tag := 'daily-progress';
      v_title := 'Today';
    end if;

    if exists (
      select 1 from public.push_deliveries d
      where d.user_id = r.recipient_id and d.kind = r.kind and d.game_day = r.game_day and d.dedupe_key = v_dedupe
    ) then
      update public.push_outbox set sent_at = pg_catalog.now(), skip_reason = 'duplicate' where id = r.id;
      continue;
    end if;

    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', sub.id, 'endpoint', sub.endpoint, 'p256dh', sub.keys->>'p256dh', 'auth', sub.keys->>'auth'
    )), '[]'::jsonb) into v_subs
    from public.push_subscriptions sub
    where sub.user_id = r.recipient_id and sub.disabled_at is null;

    if v_subs = '[]'::jsonb then
      v_held := v_held + 1;
      continue;
    end if;

    update public.push_outbox set claimed_at = pg_catalog.now() where id = r.id;
    v_items := v_items || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'outboxId', r.id,
      'dedupeKey', v_dedupe,
      'kind', r.kind,
      'title', v_title,
      'body', v_body,
      'url', v_url,
      'tag', v_tag,
      'subscriptions', v_subs
    ));
  end loop;

  return pg_catalog.jsonb_build_object('ok', true, 'items', v_items, 'held', v_held);
end $$;
revoke all on function public.push_claim(text) from public;
grant execute on function public.push_claim(text) to anon, authenticated;

create or replace function public.push_actor_ok(p_outbox uuid, p_cron_hash text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_actor uuid; v_user uuid := auth.uid();
begin
  if public.engagement_cron_ok(p_cron_hash) then return true; end if;
  if v_user is null or p_outbox is null then return false; end if;
  select actor_id into v_actor from public.push_outbox where id = p_outbox;
  return v_actor = v_user;
end $$;
revoke all on function public.push_actor_ok(uuid, text) from public, anon, authenticated, service_role;

create or replace function public.push_finalize(p_outbox_id uuid, p_dedupe_key text, p_cron_hash text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare r public.push_outbox%rowtype;
begin
  if not public.push_actor_ok(p_outbox_id, p_cron_hash) then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'unauthorized');
  end if;
  select * into r from public.push_outbox where id = p_outbox_id for update;
  if not found then return pg_catalog.jsonb_build_object('ok', false, 'reason', 'missing'); end if;
  if p_dedupe_key is null or char_length(p_dedupe_key) not between 1 and 120 then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  insert into public.push_deliveries (user_id, kind, game_day, dedupe_key)
  values (r.recipient_id, r.kind, r.game_day, p_dedupe_key)
  on conflict (user_id, kind, game_day, dedupe_key) do nothing;
  update public.push_outbox set sent_at = pg_catalog.now(), claimed_at = pg_catalog.now() where id = r.id;
  return pg_catalog.jsonb_build_object('ok', true);
end $$;
revoke all on function public.push_finalize(uuid, text, text) from public;
grant execute on function public.push_finalize(uuid, text, text) to anon, authenticated;

create or replace function public.push_release(p_outbox_id uuid, p_cron_hash text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.push_actor_ok(p_outbox_id, p_cron_hash) then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'unauthorized');
  end if;
  update public.push_outbox
    set claimed_at = null
    where id = p_outbox_id and sent_at is null;
  return pg_catalog.jsonb_build_object('ok', true);
end $$;
revoke all on function public.push_release(uuid, text) from public;
grant execute on function public.push_release(uuid, text) to anon, authenticated;

create or replace function public.push_subscription_result(
  p_subscription_id uuid, p_outbox_id uuid, p_status integer, p_cron_hash text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare r public.push_outbox%rowtype; s public.push_subscriptions%rowtype;
begin
  if not public.push_actor_ok(p_outbox_id, p_cron_hash) then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'unauthorized');
  end if;
  select * into r from public.push_outbox where id = p_outbox_id;
  select * into s from public.push_subscriptions where id = p_subscription_id;
  if not found or r.recipient_id is distinct from s.user_id then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'missing');
  end if;
  if p_status in (404, 410) then
    update public.push_subscriptions set disabled_at = pg_catalog.now() where id = s.id and disabled_at is null;
    return pg_catalog.jsonb_build_object('ok', true, 'disabled', true);
  end if;
  if p_status >= 200 and p_status < 300 then
    update public.push_subscriptions set last_success_at = pg_catalog.now() where id = s.id;
    return pg_catalog.jsonb_build_object('ok', true, 'disabled', false);
  end if;
  return pg_catalog.jsonb_build_object('ok', true, 'disabled', false);
end $$;
revoke all on function public.push_subscription_result(uuid, uuid, integer, text) from public;
grant execute on function public.push_subscription_result(uuid, uuid, integer, text) to anon, authenticated;

create or replace function public.engagement_cron_bound()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select cron_secret_hash is not null from private.engagement_config where id = 1), false)
$$;
revoke all on function public.engagement_cron_bound() from public, anon;
grant execute on function public.engagement_cron_bound() to authenticated;

create or replace function public.widget_create_token()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  u uuid := auth.uid();
  v_raw text;
  v_hash text;
  v_prefix text;
  v_id uuid;
begin
  if u is null then raise exception 'Sign-in required'; end if;
  if (select count(*) from public.widget_tokens where user_id = u and revoked_at is null) >= 5 then
    raise exception 'Revoke an unused widget token first';
  end if;
  v_raw := 'la_widget_' || replace(pg_catalog.gen_random_uuid()::text || pg_catalog.gen_random_uuid()::text, '-', '');
  v_hash := encode(extensions.digest(pg_catalog.convert_to(v_raw, 'UTF8'), 'sha256'), 'hex');
  v_prefix := left(v_raw, 16);
  insert into public.widget_tokens (user_id, token_hash, token_prefix)
  values (u, v_hash, v_prefix)
  returning id into v_id;
  return pg_catalog.jsonb_build_object('ok', true, 'id', v_id, 'token', v_raw, 'prefix', v_prefix);
end $$;
revoke all on function public.widget_create_token() from public, anon;
grant execute on function public.widget_create_token() to authenticated;

create or replace function public.widget_revoke_token(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare u uuid := auth.uid(); v_count integer;
begin
  if u is null then raise exception 'Sign-in required'; end if;
  update public.widget_tokens
    set revoked_at = pg_catalog.now()
    where id = p_id and user_id = u and revoked_at is null;
  get diagnostics v_count = row_count;
  return pg_catalog.jsonb_build_object('ok', v_count > 0);
end $$;
revoke all on function public.widget_revoke_token(uuid) from public, anon;
grant execute on function public.widget_revoke_token(uuid) to authenticated;

create or replace function public.widget_read(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare r public.widget_tokens%rowtype; v_status jsonb;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    return pg_catalog.jsonb_build_object('ok', false);
  end if;
  select * into r from public.widget_tokens
    where token_hash = p_token_hash and revoked_at is null;
  if not found then return pg_catalog.jsonb_build_object('ok', false); end if;
  update public.widget_tokens set last_used_at = pg_catalog.now() where id = r.id;
  v_status := public.engagement_own_status(r.user_id);
  return pg_catalog.jsonb_build_object('ok', true, 'status', v_status);
end $$;
revoke all on function public.widget_read(text) from public, authenticated;
grant execute on function public.widget_read(text) to anon;

alter table public.push_outbox replica identity full;

do $$
begin
  if exists (select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.push_outbox;
    exception when duplicate_object then
      null;
    end;
  end if;
end $$;

notify pgrst, 'reload schema';
