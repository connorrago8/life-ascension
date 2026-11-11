-- Izzy Companion batch 1. Reverse with supabase/rollbacks/202611080002_companion_bond_down.sql.
--
-- One consented bond. Izzy-assigned quests are Connor's normal quests and use the
-- personal base-10 streak contract. There is no companion XP bonus and no 2 XP path.
-- A manual activity Connor logs awards that same contract on Izzy's own account.
-- Voiding it inserts a negative xp_ledger_adjustments row and does not delete history.
-- Crypt's daily cap still counts xp_ledger rows only, so a void does not change it.

create table if not exists public.companion_bonds (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references auth.users(id) on delete cascade,
  companion_id uuid references auth.users(id) on delete cascade,
  status text not null check (status in ('pending','active','revoked')),
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid,
  check (status <> 'active' or companion_id is not null),
  check (inviter_id is distinct from companion_id)
);
create unique index if not exists companion_bonds_one_active_inviter
  on public.companion_bonds (inviter_id) where status = 'active';
create unique index if not exists companion_bonds_one_active_companion
  on public.companion_bonds (companion_id) where status = 'active';
create index if not exists companion_bonds_companion_idx on public.companion_bonds (companion_id);

create table if not exists public.companion_identities (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 40),
  title text not null check (title in ('Lantern Keeper','Hearth Warden','Pathfinder','Storyweaver','Dawn Herald')),
  updated_at timestamptz not null default now()
);

create table if not exists public.companion_quests (
  id uuid primary key default gen_random_uuid(),
  bond_id uuid not null references public.companion_bonds(id) on delete cascade,
  from_user uuid not null references auth.users(id) on delete cascade,
  to_user uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  description text check (description is null or char_length(description) <= 500),
  due_on date,
  reward_text text check (reward_text is null or char_length(reward_text) <= 200),
  status text not null check (status in ('sent','accepted','declined','completed')),
  quest_id uuid,
  instance_id uuid,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  completed_at timestamptz,
  check (from_user is distinct from to_user)
);
create index if not exists companion_quests_bond_idx on public.companion_quests (bond_id, created_at desc);
create index if not exists companion_quests_instance_idx on public.companion_quests (instance_id);

create table if not exists public.companion_activities (
  id uuid primary key default gen_random_uuid(),
  bond_id uuid not null references public.companion_bonds(id) on delete cascade,
  subject_id uuid not null references auth.users(id) on delete cascade,
  recorded_by uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  note text check (note is null or char_length(note) <= 500),
  dedupe_key text not null,
  quest_id uuid,
  instance_id uuid,
  ledger_id uuid,
  voided_at timestamptz,
  voided_by uuid,
  created_at timestamptz not null default now(),
  unique (recorded_by, request_id)
);
create unique index if not exists companion_activities_open_dedupe
  on public.companion_activities (subject_id, dedupe_key) where voided_at is null;

create table if not exists public.xp_ledger_adjustments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  ledger_id uuid not null unique references public.xp_ledger(id) on delete cascade,
  amount integer not null check (amount between -1000000 and -1),
  reason text not null check (reason in ('companion_activity_void')),
  created_at timestamptz not null default now()
);

alter table public.companion_bonds enable row level security;
alter table public.companion_identities enable row level security;
alter table public.companion_quests enable row level security;
alter table public.companion_activities enable row level security;
alter table public.xp_ledger_adjustments enable row level security;

drop policy if exists companion_bonds_read on public.companion_bonds;
create policy companion_bonds_read on public.companion_bonds for select to authenticated
  using (inviter_id = (select auth.uid()) or companion_id = (select auth.uid()));
drop policy if exists companion_identities_read on public.companion_identities;
create policy companion_identities_read on public.companion_identities for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.companion_bonds b
      where b.status = 'active'
        and (select auth.uid()) in (b.inviter_id, b.companion_id)
        and user_id in (b.inviter_id, b.companion_id)
    )
  );
drop policy if exists companion_quests_read on public.companion_quests;
create policy companion_quests_read on public.companion_quests for select to authenticated
  using (from_user = (select auth.uid()) or to_user = (select auth.uid()));
drop policy if exists companion_activities_read on public.companion_activities;
create policy companion_activities_read on public.companion_activities for select to authenticated
  using (subject_id = (select auth.uid()) or recorded_by = (select auth.uid()));
drop policy if exists xp_adjustments_read on public.xp_ledger_adjustments;
create policy xp_adjustments_read on public.xp_ledger_adjustments for select to authenticated
  using (owner_id = (select auth.uid()));

revoke all on public.companion_bonds, public.companion_identities, public.companion_quests,
  public.companion_activities, public.xp_ledger_adjustments from public, anon, authenticated;
grant select on public.companion_bonds, public.companion_identities, public.companion_quests,
  public.companion_activities, public.xp_ledger_adjustments to authenticated;

create or replace function public.companion_title_key(p_title text)
returns text language sql immutable strict set search_path = ''
as $$ select lower(pg_catalog.regexp_replace(pg_catalog.btrim(p_title), '\s+', ' ', 'g')) $$;
revoke all on function public.companion_title_key(text) from public, anon, authenticated;

-- A fully voided award no longer counts as a game-day completion. Positive rows are unchanged.
create or replace function public.quest_has_completion_on(p_owner uuid, p_day date, p_tz text)
returns boolean language sql stable set search_path = ''
as $$
  select exists (
    select 1 from public.xp_ledger l
    where l.owner_id = p_owner
      and l.awarded_at >= ((p_day::timestamp + interval '5 hours') at time zone p_tz)
      and l.awarded_at < (((p_day + 1)::timestamp + interval '5 hours') at time zone p_tz)
      and l.amount + coalesce((select sum(a.amount) from public.xp_ledger_adjustments a where a.ledger_id = l.id), 0) > 0)
$$;

create or replace function public.get_lifetime_xp()
returns bigint language sql stable security invoker set search_path = ''
as $$
  select (
    coalesce((select sum(amount) from public.xp_ledger where owner_id = (select auth.uid())), 0)
    + coalesce((select sum(amount) from public.xp_ledger_adjustments where owner_id = (select auth.uid())), 0)
  )::bigint
$$;
revoke all on function public.get_lifetime_xp() from public, anon;
grant execute on function public.get_lifetime_xp() to authenticated;

-- Always the personal contract. Removes any hosted 2 XP Izzy branch.
create or replace function public._award_quest_xp(p_owner uuid, p_instance uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
begin
  return public._award_personal_quest_xp(p_owner, p_instance);
end $$;
revoke all on function public._award_quest_xp(uuid, uuid) from public, anon, authenticated, service_role;

create or replace function public.companion_state()
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  u uuid := auth.uid();
  b public.companion_bonds%rowtype;
  partner uuid;
begin
  if u is null then raise exception 'Sign-in required'; end if;
  update public.companion_quests q
    set status = 'completed', completed_at = coalesce(q.completed_at, i.completed_at)
    from public.quest_instances i
    where q.instance_id = i.id and i.status = 'completed' and q.status = 'accepted'
      and u in (q.from_user, q.to_user);
  select * into b from public.companion_bonds
    where u in (inviter_id, companion_id)
    order by (status = 'active') desc, (status = 'pending') desc, created_at desc
    limit 1;
  if not found then
    return jsonb_build_object('userId', u, 'bond', null, 'quests', '[]'::jsonb, 'activities', '[]'::jsonb);
  end if;
  partner := case when b.inviter_id = u then b.companion_id else b.inviter_id end;
  return jsonb_build_object(
    'userId', u,
    'bond', jsonb_build_object(
      'id', b.id,
      'status', b.status,
      'role', case when b.inviter_id = u then 'inviter' else 'companion' end,
      'expiresAt', b.expires_at,
      'partnerId', partner,
      'partnerName', (
        select display_name from public.companion_identities where user_id = partner
      ),
      'partnerTitle', (
        select title from public.companion_identities where user_id = partner
      )
    ),
    'identity', (
      select jsonb_build_object('displayName', display_name, 'title', title)
      from public.companion_identities where user_id = u
    ),
    'quests', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', q.id, 'title', q.title, 'description', q.description, 'dueOn', q.due_on,
        'rewardText', q.reward_text, 'status', q.status, 'fromUser', q.from_user, 'toUser', q.to_user,
        'instanceId', q.instance_id, 'createdAt', q.created_at
      ) order by q.created_at desc)
      from public.companion_quests q where q.bond_id = b.id
    ), '[]'::jsonb),
    'activities', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'title', a.title, 'note', a.note, 'recordedBy', a.recorded_by,
        'subjectId', a.subject_id, 'xp', l.amount, 'voided', a.voided_at is not null, 'createdAt', a.created_at
      ) order by a.created_at desc)
      from public.companion_activities a
      left join public.xp_ledger l on l.id = a.ledger_id
      where a.bond_id = b.id
    ), '[]'::jsonb)
  );
end $$;
revoke all on function public.companion_state() from public, anon;
grant execute on function public.companion_state() to authenticated;

create or replace function public.companion_invite()
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare u uuid := auth.uid(); v_code text; v_id uuid; v_expires timestamptz := pg_catalog.now() + interval '7 days';
begin
  if u is null then raise exception 'Sign-in required'; end if;
  if exists (select 1 from public.companion_bonds where status = 'active' and u in (inviter_id, companion_id)) then
    raise exception 'You already have a companion';
  end if;
  update public.companion_bonds
    set status = 'revoked', revoked_at = pg_catalog.now(), revoked_by = u
    where inviter_id = u and status = 'pending';
  v_code := substr(replace(pg_catalog.gen_random_uuid()::text, '-', ''), 1, 12);
  insert into public.companion_bonds(inviter_id, status, token_hash, expires_at)
    values (u, 'pending', encode(public.digest(pg_catalog.convert_to(lower(v_code), 'UTF8'), 'sha256'), 'hex'), v_expires)
    returning id into v_id;
  return jsonb_build_object('bondId', v_id, 'code', v_code, 'expiresAt', v_expires);
end $$;
revoke all on function public.companion_invite() from public, anon;
grant execute on function public.companion_invite() to authenticated;

create or replace function public.companion_accept(p_code text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  u uuid := auth.uid();
  v_hash text;
  b public.companion_bonds%rowtype;
begin
  if u is null then raise exception 'Sign-in required'; end if;
  if p_code is null or length(btrim(p_code)) < 8 then raise exception 'Invitation unavailable'; end if;
  v_hash := encode(public.digest(pg_catalog.convert_to(lower(btrim(p_code)), 'UTF8'), 'sha256'), 'hex');
  select * into b from public.companion_bonds where token_hash = v_hash for update;
  if not found then raise exception 'Invitation unavailable'; end if;
  if b.inviter_id = u then raise exception 'You cannot accept your own invitation'; end if;
  if b.status = 'revoked' then raise exception 'Invitation revoked'; end if;
  if b.status = 'active' and b.companion_id = u then
    return jsonb_build_object('accepted', true, 'already', true, 'bondId', b.id);
  end if;
  if b.status = 'active' then raise exception 'Invitation unavailable'; end if;
  if b.expires_at <= pg_catalog.now() then raise exception 'Invitation expired'; end if;
  if exists (select 1 from public.companion_bonds where status = 'active' and u in (inviter_id, companion_id)) then
    raise exception 'You already have a companion';
  end if;
  update public.companion_bonds
    set companion_id = u, status = 'active', accepted_at = pg_catalog.now()
    where id = b.id;
  return jsonb_build_object('accepted', true, 'already', false, 'bondId', b.id);
end $$;
revoke all on function public.companion_accept(text) from public, anon;
grant execute on function public.companion_accept(text) to authenticated;

create or replace function public.companion_revoke(p_bond uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare u uuid := auth.uid(); b public.companion_bonds%rowtype;
begin
  if u is null then raise exception 'Sign-in required'; end if;
  select * into b from public.companion_bonds where id = p_bond for update;
  if not found or u not in (b.inviter_id, b.companion_id) then raise exception 'Companion connection required'; end if;
  if b.status = 'revoked' then return jsonb_build_object('revoked', true, 'already', true); end if;
  update public.companion_bonds
    set status = 'revoked', revoked_at = pg_catalog.now(), revoked_by = u
    where id = b.id;
  return jsonb_build_object('revoked', true, 'already', false);
end $$;
revoke all on function public.companion_revoke(uuid) from public, anon;
grant execute on function public.companion_revoke(uuid) to authenticated;

create or replace function public.companion_set_identity(p_name text, p_title text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'Sign-in required'; end if;
  if not exists (
    select 1 from public.companion_bonds
    where status = 'active' and companion_id = u
  ) then raise exception 'Companion connection required'; end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 40 then raise exception 'Invalid name'; end if;
  if p_title not in ('Lantern Keeper','Hearth Warden','Pathfinder','Storyweaver','Dawn Herald') then
    raise exception 'Invalid title';
  end if;
  insert into public.companion_identities(user_id, display_name, title)
    values (u, btrim(p_name), p_title)
    on conflict (user_id) do update
      set display_name = excluded.display_name, title = excluded.title, updated_at = pg_catalog.now();
  return jsonb_build_object('saved', true, 'displayName', btrim(p_name), 'title', p_title);
end $$;
revoke all on function public.companion_set_identity(text, text) from public, anon;
grant execute on function public.companion_set_identity(text, text) to authenticated;

create or replace function public.companion_send_quest(
  p_title text, p_description text, p_due date, p_reward text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  u uuid := auth.uid();
  b public.companion_bonds%rowtype;
  v_id uuid;
  v_title text := btrim(p_title);
  v_desc text := nullif(btrim(coalesce(p_description, '')), '');
  v_reward text := nullif(btrim(coalesce(p_reward, '')), '');
begin
  if u is null then raise exception 'Sign-in required'; end if;
  select * into b from public.companion_bonds where status = 'active' and companion_id = u for update;
  if not found then raise exception 'Companion connection required'; end if;
  if v_title is null or char_length(v_title) not between 1 and 120 then raise exception 'Invalid title'; end if;
  if v_desc is not null and char_length(v_desc) > 500 then raise exception 'Invalid description'; end if;
  if v_reward is not null and char_length(v_reward) > 200 then raise exception 'Invalid reward'; end if;
  insert into public.companion_quests(bond_id, from_user, to_user, title, description, due_on, reward_text, status)
    values (b.id, u, b.inviter_id, v_title, v_desc, p_due, v_reward, 'sent')
    returning id into v_id;
  return jsonb_build_object('questId', v_id, 'status', 'sent');
end $$;
revoke all on function public.companion_send_quest(text, text, date, text) from public, anon;
grant execute on function public.companion_send_quest(text, text, date, text) to authenticated;

create or replace function public.companion_respond_quest(p_quest uuid, p_accept boolean)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  u uuid := auth.uid();
  q public.companion_quests%rowtype;
  b public.companion_bonds%rowtype;
  v_today date;
  v_due date;
  v_norm text;
  v_quest uuid;
  v_inst uuid;
  v_status text;
begin
  if u is null then raise exception 'Sign-in required'; end if;
  select * into q from public.companion_quests where id = p_quest for update;
  if not found or q.to_user <> u then raise exception 'Quest not found'; end if;
  select * into b from public.companion_bonds where id = q.bond_id;
  if b.status <> 'active' then raise exception 'Companion connection required'; end if;
  if q.status = 'declined' and p_accept is false then
    return jsonb_build_object('status', 'declined', 'already', true);
  end if;
  if q.status <> 'sent' then raise exception 'Already decided'; end if;
  if p_accept is not true then
    update public.companion_quests set status = 'declined' where id = q.id;
    return jsonb_build_object('status', 'declined', 'already', false);
  end if;
  v_today := public.quest_game_day(pg_catalog.now(), public.quest_timezone(u));
  v_due := coalesce(q.due_on, v_today);
  v_norm := public.companion_title_key(q.title);
  select i.quest_id, i.id, i.status into v_quest, v_inst, v_status
    from public.quests existing
    join public.quest_instances i on i.quest_id = existing.id and i.owner_id = existing.owner_id
    where existing.owner_id = u and existing.active
      and public.companion_title_key(existing.title) = v_norm
      and (
        (existing.cadence = 'daily' and i.due_date = v_today)
        or (existing.cadence in ('once','weekly') and i.status <> 'completed')
        or (i.status = 'completed' and public.quest_game_day(i.completed_at, public.quest_timezone(u)) = v_today)
      )
    order by (i.status = 'available') desc, i.created_at desc
    limit 1;
  if v_inst is null then
    v_quest := public.create_scheduled_quest(q.title, 'relationships', 'once', v_due, 'scheduled');
    select id into v_inst from public.quest_instances where quest_id = v_quest and owner_id = u order by created_at desc limit 1;
    v_status := 'available';
  end if;
  update public.companion_quests
    set status = case when v_status = 'completed' then 'completed' else 'accepted' end,
        quest_id = v_quest,
        instance_id = v_inst,
        accepted_at = pg_catalog.now(),
        completed_at = case when v_status = 'completed' then pg_catalog.now() else null end
    where id = q.id;
  return jsonb_build_object(
    'status', case when v_status = 'completed' then 'completed' else 'accepted' end,
    'instanceId', v_inst,
    'linkedExisting', v_status is not null and v_quest is not null);
end $$;
revoke all on function public.companion_respond_quest(uuid, boolean) from public, anon;
grant execute on function public.companion_respond_quest(uuid, boolean) to authenticated;

create or replace function public.companion_complete_quest(p_quest uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  u uuid := auth.uid();
  q public.companion_quests%rowtype;
  receipt jsonb;
begin
  if u is null then raise exception 'Sign-in required'; end if;
  select * into q from public.companion_quests where id = p_quest for update;
  if not found or q.to_user <> u then raise exception 'Quest not found'; end if;
  if q.status = 'completed' then
    return jsonb_build_object('status', 'completed', 'already', true, 'xp_awarded', 0);
  end if;
  if q.status <> 'accepted' or q.instance_id is null then raise exception 'Quest not found'; end if;
  receipt := public.set_quest_instance_status_v2(q.instance_id, 'complete');
  if receipt->>'status' = 'completed' then
    update public.companion_quests
      set status = 'completed', completed_at = coalesce(completed_at, pg_catalog.now())
      where instance_id = q.instance_id and status = 'accepted';
  end if;
  return receipt || jsonb_build_object('companionQuestId', q.id);
end $$;
revoke all on function public.companion_complete_quest(uuid) from public, anon;
grant execute on function public.companion_complete_quest(uuid) to authenticated;

create or replace function public.companion_log_activity(p_request uuid, p_title text, p_note text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  u uuid := auth.uid();
  b public.companion_bonds%rowtype;
  v_title text := btrim(p_title);
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_day date;
  v_key text;
  existing public.companion_activities%rowtype;
  v_quest uuid;
  v_inst uuid;
  v_award jsonb;
  v_ledger uuid;
  v_id uuid;
begin
  if u is null then raise exception 'Sign-in required'; end if;
  if p_request is null then raise exception 'Invalid activity'; end if;
  select * into b from public.companion_bonds where status = 'active' and inviter_id = u for update;
  if not found or b.companion_id is null then raise exception 'Companion connection required'; end if;
  if v_title is null or char_length(v_title) not between 1 and 120 then raise exception 'Invalid title'; end if;
  if v_note is not null and char_length(v_note) > 500 then raise exception 'Invalid note'; end if;
  select * into existing from public.companion_activities where recorded_by = u and request_id = p_request;
  if found then
    if public.companion_title_key(existing.title) is distinct from public.companion_title_key(v_title) then
      raise exception 'Request ID reused with different payload';
    end if;
    return jsonb_build_object('activityId', existing.id, 'already', true, 'xpAwarded', 0, 'voided', existing.voided_at is not null);
  end if;
  v_day := public.quest_game_day(pg_catalog.now(), public.quest_timezone(b.companion_id));
  v_key := b.companion_id::text || ':' || public.companion_title_key(v_title) || ':' || v_day::text;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('companion-activity:' || v_key, 0));
  select * into existing from public.companion_activities
    where subject_id = b.companion_id and dedupe_key = v_key and voided_at is null;
  if found then
    return jsonb_build_object('activityId', existing.id, 'already', true, 'xpAwarded', 0, 'voided', false);
  end if;
  insert into public.quests(owner_id, title, domain, cadence, scheduled_for, quest_type)
    values (b.companion_id, v_title, 'relationships', 'once', v_day, 'scheduled')
    returning id into v_quest;
  insert into public.quest_instances(owner_id, quest_id, due_date)
    values (b.companion_id, v_quest, v_day)
    returning id into v_inst;
  v_award := public._award_personal_quest_xp(b.companion_id, v_inst);
  select id into v_ledger from public.xp_ledger where instance_id = v_inst and owner_id = b.companion_id;
  insert into public.companion_activities(
    bond_id, subject_id, recorded_by, request_id, title, note, dedupe_key, quest_id, instance_id, ledger_id)
    values (b.id, b.companion_id, u, p_request, v_title, v_note, v_key, v_quest, v_inst, v_ledger)
    returning id into v_id;
  return jsonb_build_object(
    'activityId', v_id, 'already', false,
    'xpAwarded', coalesce((v_award->>'amount')::integer, 0),
    'firstOfDay', v_award->'first_of_day',
    'fire', v_award->'fire',
    'voided', false);
end $$;
revoke all on function public.companion_log_activity(uuid, text, text) from public, anon;
grant execute on function public.companion_log_activity(uuid, text, text) to authenticated;

create or replace function public.companion_void_activity(p_activity uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  u uuid := auth.uid();
  a public.companion_activities%rowtype;
  v_amount integer;
begin
  if u is null then raise exception 'Sign-in required'; end if;
  select * into a from public.companion_activities where id = p_activity for update;
  if not found or u not in (a.recorded_by, a.subject_id) then raise exception 'Activity not found'; end if;
  if a.voided_at is not null then
    return jsonb_build_object('voided', true, 'already', true);
  end if;
  select amount into v_amount from public.xp_ledger where id = a.ledger_id and owner_id = a.subject_id;
  if v_amount is null or v_amount < 1 then raise exception 'Activity not found'; end if;
  insert into public.xp_ledger_adjustments(owner_id, ledger_id, amount, reason)
    values (a.subject_id, a.ledger_id, -v_amount, 'companion_activity_void')
    on conflict (ledger_id) do nothing;
  update public.companion_activities
    set voided_at = pg_catalog.now(), voided_by = u
    where id = a.id;
  return jsonb_build_object('voided', true, 'already', false, 'reversed', v_amount);
end $$;
revoke all on function public.companion_void_activity(uuid) from public, anon;
grant execute on function public.companion_void_activity(uuid) to authenticated;

notify pgrst, 'reload schema';
