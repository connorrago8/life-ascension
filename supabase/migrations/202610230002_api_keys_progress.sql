-- Personal API keys and quest progress notes.
-- Apply after 202610230001_core.sql and before later scheduling migrations.
-- New tables and functions only. Does not replace quest scheduling or XP functions.
-- Progress notes are a journal. This migration never writes xp_ledger or quest status.

create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  prefix text not null check (prefix ~ '^la_live_[A-Za-z0-9_-]{8}$'),
  key_hash text not null unique check (key_hash ~ '^[0-9a-f]{64}$'),
  scopes text[] not null default '{quests:read,quests:write}' check (
    cardinality(scopes) >= 1
    and scopes <@ array['quests:read','quests:write']::text[]
  ),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

comment on table public.api_keys is
  'Hashed personal API keys. Plaintext is never stored. key_hash is SHA-256 hex of the full key.';
comment on column public.api_keys.prefix is
  'Leading characters shown in the UI: la_live_ plus 8 characters of the secret. Not itself a secret.';
comment on column public.api_keys.key_hash is
  'Lowercase SHA-256 hex of the full API key. Clients must not select this column.';

create index api_keys_user_created_idx on public.api_keys (user_id, created_at desc);

create table public.quest_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  quest_id uuid not null,
  instance_id uuid,
  note text not null check (char_length(note) between 1 and 1000),
  percent integer check (percent is null or (percent >= 0 and percent <= 100)),
  source text not null check (source in ('web','chatgpt','grok','api')),
  created_at timestamptz not null default now(),
  foreign key (quest_id, user_id) references public.quests (id, owner_id) on delete cascade,
  foreign key (instance_id) references public.quest_instances (id) on delete set null
);

comment on table public.quest_progress is
  'Partial progress notes. Inserts go through add_quest_progress. Notes never award XP and never change quest status.';

create index quest_progress_user_created_idx on public.quest_progress (user_id, created_at desc);
create index quest_progress_quest_created_idx on public.quest_progress (quest_id, created_at desc);

alter table public.api_keys enable row level security;
alter table public.quest_progress enable row level security;

create policy api_keys_read on public.api_keys
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy quest_progress_read on public.quest_progress
  for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.api_keys from public, anon, authenticated;
revoke all on table public.quest_progress from public, anon, authenticated;

-- Safe columns only. key_hash stays ungranted so PostgREST cannot return it to a user JWT.
grant select (
  id,
  user_id,
  name,
  prefix,
  scopes,
  created_at,
  last_used_at,
  revoked_at
) on table public.api_keys to authenticated;

grant select on table public.quest_progress to authenticated;

create view public.api_keys_safe
with (security_barrier = true, security_invoker = true) as
select
  id,
  user_id,
  name,
  prefix,
  scopes,
  created_at,
  last_used_at,
  revoked_at
from public.api_keys
where user_id = (select auth.uid());

comment on view public.api_keys_safe is
  'Caller-owned API key metadata. Excludes key_hash. Inserts are server-only; revocation uses revoke_api_key.';

revoke all on table public.api_keys_safe from public, anon, authenticated;
grant select on table public.api_keys_safe to authenticated;

-- Lookup is service-role only. It compares SHA-256 digests, rejects revoked keys,
-- and stamps last_used_at. Granted to service_role below when that role exists.
create or replace function public.authenticate_api_key(p_key_hash text)
returns table (user_id uuid, scopes text[], key_id uuid, key_hash text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec record;
  provided bytea;
  stored bytea;
  diff integer := 0;
  i integer;
begin
  if p_key_hash is null or p_key_hash !~ '^[0-9a-f]{64}$' then
    return;
  end if;

  provided := pg_catalog.decode(p_key_hash, 'hex');

  select k.id, k.user_id, k.scopes, k.revoked_at, k.key_hash
    into rec
  from public.api_keys k
  where k.key_hash = p_key_hash;

  if not found then
    -- Touch every digest byte on a miss, then reject. The index probe itself is not constant-time;
    -- keys are 256-bit, and plaintext is never compared or stored.
    for i in 0 .. pg_catalog.octet_length(provided) - 1 loop
      diff := diff | (pg_catalog.get_byte(provided, i) # pg_catalog.get_byte(provided, i));
    end loop;
    return;
  end if;

  stored := pg_catalog.decode(rec.key_hash, 'hex');
  if pg_catalog.octet_length(provided) <> pg_catalog.octet_length(stored) then
    diff := 1;
  else
    for i in 0 .. pg_catalog.octet_length(provided) - 1 loop
      diff := diff | (pg_catalog.get_byte(provided, i) # pg_catalog.get_byte(stored, i));
    end loop;
  end if;

  if diff <> 0 or rec.revoked_at is not null then
    return;
  end if;

  update public.api_keys as k
     set last_used_at = pg_catalog.now()
   where k.id = rec.id
     and k.key_hash = p_key_hash
     and k.revoked_at is null;

  if not found then
    return;
  end if;

  user_id := rec.user_id;
  scopes := rec.scopes;
  key_id := rec.id;
  key_hash := rec.key_hash;
  return next;
end;
$$;

create or replace function public.revoke_api_key(p_key_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  update public.api_keys
     set revoked_at = coalesce(revoked_at, pg_catalog.now())
   where id = p_key_id
     and user_id = auth.uid();

  if not found then
    raise exception 'API key not found';
  end if;
end;
$$;

-- Ownership is checked against auth.uid(). This function only inserts a note.
create or replace function public.add_quest_progress(
  p_quest_id uuid,
  p_note text,
  p_percent integer default null,
  p_instance_id uuid default null,
  p_source text default 'web'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_quest_id is null then
    raise exception 'Quest not found';
  end if;
  if p_note is null
     or pg_catalog.char_length(p_note) > 1000
     or pg_catalog.char_length(pg_catalog.btrim(p_note)) < 1 then
    raise exception 'Note must be 1 to 1000 characters';
  end if;
  if p_percent is not null and (p_percent < 0 or p_percent > 100) then
    raise exception 'Percent must be between 0 and 100';
  end if;
  if p_source is null or p_source not in ('web', 'chatgpt', 'grok', 'api') then
    raise exception 'Unsupported source';
  end if;

  perform 1
    from public.quests q
   where q.id = p_quest_id
     and q.owner_id = auth.uid();
  if not found then
    raise exception 'Quest not found';
  end if;

  if p_instance_id is not null then
    perform 1
      from public.quest_instances i
     where i.id = p_instance_id
       and i.owner_id = auth.uid()
       and i.quest_id = p_quest_id;
    if not found then
      raise exception 'Instance not found';
    end if;
  end if;

  insert into public.quest_progress (user_id, quest_id, instance_id, note, percent, source)
  values (auth.uid(), p_quest_id, p_instance_id, pg_catalog.btrim(p_note), p_percent, p_source)
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.authenticate_api_key(text) from public, anon, authenticated;
revoke all on function public.revoke_api_key(uuid) from public, anon;
revoke all on function public.add_quest_progress(uuid, text, integer, uuid, text) from public, anon;

grant execute on function public.revoke_api_key(uuid) to authenticated;
grant execute on function public.add_quest_progress(uuid, text, integer, uuid, text) to authenticated;

do $$
begin
  if exists (select 1 from pg_catalog.pg_roles where rolname = 'service_role') then
    grant select, insert, update on table public.api_keys to service_role;
    grant select on table public.quest_progress to service_role;
    grant execute on function public.authenticate_api_key(text) to service_role;
  end if;
end;
$$;

notify pgrst, 'reload schema';
