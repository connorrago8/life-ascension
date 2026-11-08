-- Izzy batch 2. Cosmetic only: no new XP. Reverse with
-- supabase/rollbacks/202611080005_companion_batch2_down.sql.

alter table public.companion_identities
  add column if not exists quest_color text not null default 'amber';
alter table public.companion_identities
  drop constraint if exists companion_identities_quest_color_check;
alter table public.companion_identities
  add constraint companion_identities_quest_color_check
  check (quest_color in ('amber','rose','sage','sky','violet'));
alter table public.companion_identities
  add column if not exists avatar_path text;
alter table public.companion_identities
  drop constraint if exists companion_identities_avatar_path_check;
alter table public.companion_identities
  add constraint companion_identities_avatar_path_check
  check (avatar_path is null or char_length(avatar_path) between 1 and 200);

create table if not exists public.companion_tips (
  user_id uuid not null references auth.users(id) on delete cascade,
  tip_key text not null check (tip_key in ('izzy-send','izzy-board','izzy-planner','connor-board','connor-proof')),
  seen_at timestamptz not null default now(),
  primary key (user_id, tip_key)
);
create table if not exists public.companion_notices (
  id uuid primary key default gen_random_uuid(),
  bond_id uuid not null references public.companion_bonds(id) on delete cascade,
  to_user uuid not null references auth.users(id) on delete cascade,
  quest_id uuid references public.companion_quests(id) on delete cascade,
  kind text not null check (kind in ('completed','thanks')),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create unique index if not exists companion_notices_once on public.companion_notices (quest_id, kind);
create table if not exists public.companion_nudges (
  id uuid primary key default gen_random_uuid(),
  bond_id uuid not null references public.companion_bonds(id) on delete cascade,
  quest_id uuid not null references public.companion_quests(id) on delete cascade,
  game_day date not null,
  created_at timestamptz not null default now(),
  unique (quest_id, game_day)
);
create table if not exists public.companion_rewards (
  id uuid primary key default gen_random_uuid(),
  bond_id uuid not null references public.companion_bonds(id) on delete cascade,
  reward_text text not null check (char_length(btrim(reward_text)) between 1 and 200),
  goal_count integer not null check (goal_count between 1 and 100),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.companion_repeats (
  id uuid primary key default gen_random_uuid(),
  bond_id uuid not null references public.companion_bonds(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  description text check (description is null or char_length(description) <= 500),
  cadence text not null check (cadence in ('daily','weekly')),
  weekday smallint not null check (weekday between 1 and 7),
  active boolean not null default true,
  deleted_at timestamptz,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.companion_repeat_spawns (
  repeat_id uuid not null references public.companion_repeats(id) on delete cascade,
  game_day date not null,
  quest_id uuid not null,
  primary key (repeat_id, game_day)
);
create table if not exists public.companion_proofs (
  id uuid primary key default gen_random_uuid(),
  bond_id uuid not null references public.companion_bonds(id) on delete cascade,
  instance_id uuid not null unique,
  quest_id uuid,
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  content_type text not null check (content_type in ('image/jpeg','image/png','image/webp')),
  byte_size integer not null check (byte_size between 1 and 1500000),
  storage_path text not null check (char_length(storage_path) between 1 and 200),
  created_at timestamptz not null default now()
);

alter table public.companion_tips enable row level security;
alter table public.companion_notices enable row level security;
alter table public.companion_nudges enable row level security;
alter table public.companion_rewards enable row level security;
alter table public.companion_repeats enable row level security;
alter table public.companion_repeat_spawns enable row level security;
alter table public.companion_proofs enable row level security;

drop policy if exists companion_tips_read on public.companion_tips;
create policy companion_tips_read on public.companion_tips for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists companion_notices_read on public.companion_notices;
create policy companion_notices_read on public.companion_notices for select to authenticated
  using (to_user = (select auth.uid()));
drop policy if exists companion_nudges_read on public.companion_nudges;
create policy companion_nudges_read on public.companion_nudges for select to authenticated
  using (exists (
    select 1 from public.companion_bonds b
    where b.id = bond_id and b.status = 'active' and (select auth.uid()) in (b.inviter_id, b.companion_id)
  ));
drop policy if exists companion_rewards_read on public.companion_rewards;
create policy companion_rewards_read on public.companion_rewards for select to authenticated
  using (exists (
    select 1 from public.companion_bonds b
    where b.id = bond_id and (select auth.uid()) in (b.inviter_id, b.companion_id)
  ));
drop policy if exists companion_repeats_read on public.companion_repeats;
create policy companion_repeats_read on public.companion_repeats for select to authenticated
  using (exists (
    select 1 from public.companion_bonds b
    where b.id = bond_id and (select auth.uid()) in (b.inviter_id, b.companion_id)
  ));
drop policy if exists companion_spawns_read on public.companion_repeat_spawns;
create policy companion_spawns_read on public.companion_repeat_spawns for select to authenticated
  using (exists (
    select 1 from public.companion_repeats r
    join public.companion_bonds b on b.id = r.bond_id
    where r.id = repeat_id and (select auth.uid()) in (b.inviter_id, b.companion_id)
  ));
drop policy if exists companion_proofs_read on public.companion_proofs;
create policy companion_proofs_read on public.companion_proofs for select to authenticated
  using (exists (
    select 1 from public.companion_bonds b
    where b.id = bond_id and b.status = 'active' and (select auth.uid()) in (b.inviter_id, b.companion_id)
  ));

revoke all on public.companion_tips, public.companion_notices, public.companion_nudges,
  public.companion_rewards, public.companion_repeats, public.companion_repeat_spawns, public.companion_proofs
  from public, anon, authenticated;
grant select on public.companion_tips, public.companion_notices, public.companion_nudges,
  public.companion_rewards, public.companion_repeats, public.companion_repeat_spawns, public.companion_proofs
  to authenticated;

-- Private proof bucket. Skipped where this database has no Storage schema.
do $bucket$
begin
  if to_regclass('storage.buckets') is null then return; end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('companion-proof', 'companion-proof', false, 1500000, array['image/jpeg','image/png','image/webp']::text[])
  on conflict (id) do update
    set public = false, file_size_limit = 1500000, allowed_mime_types = array['image/jpeg','image/png','image/webp']::text[];
  execute 'drop policy if exists companion_proof_read on storage.objects';
  execute 'drop policy if exists companion_proof_insert on storage.objects';
  execute $policy$
    create policy companion_proof_read on storage.objects for select to authenticated
    using (
      bucket_id = 'companion-proof'
      and exists (
        select 1 from public.companion_bonds b
        where b.status = 'active'
          and (select auth.uid()) in (b.inviter_id, b.companion_id)
          and (storage.foldername(name))[1] = b.id::text
      )
    )
  $policy$;
  execute $policy$
    create policy companion_proof_insert on storage.objects for insert to authenticated
    with check (
      bucket_id = 'companion-proof'
      and exists (
        select 1 from public.companion_bonds b
        where b.status = 'active'
          and b.inviter_id = (select auth.uid())
          and (storage.foldername(name))[1] = b.id::text
      )
    )
  $policy$;
end
$bucket$;

create or replace function public._companion_materialize(p_bond uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  b public.companion_bonds%rowtype;
  r public.companion_repeats%rowtype;
  v_today date;
  v_dow integer;
  v_quest uuid;
begin
  select * into b from public.companion_bonds where id = p_bond and status = 'active';
  if not found or b.companion_id is null then return; end if;
  v_today := public.quest_game_day(pg_catalog.now(), public.quest_timezone(b.inviter_id));
  v_dow := pg_catalog.date_part('isodow', v_today)::integer;
  for r in
    select * from public.companion_repeats
    where bond_id = b.id and active and deleted_at is null and weekday = v_dow
  loop
    if exists (select 1 from public.companion_repeat_spawns where repeat_id = r.id and game_day = v_today) then
      continue;
    end if;
    insert into public.companion_quests(bond_id, from_user, to_user, title, description, due_on, status, cadence)
      values (b.id, b.companion_id, b.inviter_id, r.title, r.description, v_today, 'sent', r.cadence)
      returning id into v_quest;
    perform public._place_companion_quest(v_quest);
    insert into public.companion_repeat_spawns(repeat_id, game_day, quest_id) values (r.id, v_today, v_quest);
  end loop;
end $$;
revoke all on function public._companion_materialize(uuid) from public, anon, authenticated, service_role;

create or replace function public.companion_state()
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  u uuid := auth.uid();
  b public.companion_bonds%rowtype;
  partner uuid;
  v_tz text;
  v_today date;
  v_week date;
  v_done integer := 0;
  v_week_done integer := 0;
  v_dailies integer := 0;
  v_dailies_done integer := 0;
  v_xp integer := 0;
  v_streak integer := 0;
  v_cursor date;
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
    return jsonb_build_object('userId', u, 'bond', null, 'quests', '[]'::jsonb, 'activities', '[]'::jsonb,
      'notices', '[]'::jsonb, 'rewards', '[]'::jsonb, 'repeats', '[]'::jsonb, 'milestones', '[]'::jsonb);
  end if;
  if b.status = 'active' then
    perform public._companion_materialize(b.id);
    insert into public.companion_notices(bond_id, to_user, quest_id, kind)
    select q.bond_id, q.from_user, q.id, 'completed'
    from public.companion_quests q
    where q.bond_id = b.id and q.status = 'completed'
      and not exists (
        select 1 from public.companion_notices n where n.quest_id = q.id and n.kind = 'completed'
      );
  end if;
  partner := case when b.inviter_id = u then b.companion_id else b.inviter_id end;
  v_tz := public.quest_timezone(b.inviter_id);
  v_today := public.quest_game_day(pg_catalog.now(), v_tz);
  v_week := public.quest_week_start(v_today);
  select count(*) filter (where status = 'completed'),
         count(*) filter (where status = 'completed' and public.quest_week_start(coalesce(due_on, v_today)) = v_week),
         count(*) filter (where cadence = 'daily' and public.quest_week_start(coalesce(due_on, v_today)) = v_week),
         count(*) filter (where cadence = 'daily' and status = 'completed' and public.quest_week_start(coalesce(due_on, v_today)) = v_week)
    into v_done, v_week_done, v_dailies, v_dailies_done
    from public.companion_quests where bond_id = b.id;
  select coalesce(sum(l.amount), 0) into v_xp
    from public.xp_ledger l
    join public.companion_quests q on q.instance_id = l.instance_id
    where q.bond_id = b.id
      and public.quest_week_start(public.quest_game_day(l.awarded_at, v_tz)) = v_week;
  v_cursor := v_today;
  if not exists (
    select 1 from public.companion_quests q
    join public.quest_instances i on i.id = q.instance_id
    where q.bond_id = b.id and i.status = 'completed'
      and public.quest_game_day(i.completed_at, v_tz) = v_cursor
  ) then v_cursor := v_cursor - 1; end if;
  while v_streak < 366 and exists (
    select 1 from public.companion_quests q
    join public.quest_instances i on i.id = q.instance_id
    where q.bond_id = b.id and i.status = 'completed'
      and public.quest_game_day(i.completed_at, v_tz) = v_cursor
  ) loop
    v_streak := v_streak + 1;
    v_cursor := v_cursor - 1;
  end loop;
  return jsonb_build_object(
    'userId', u,
    'bond', jsonb_build_object(
      'id', b.id, 'status', b.status,
      'role', case when b.inviter_id = u then 'inviter' else 'companion' end,
      'expiresAt', b.expires_at, 'partnerId', partner,
      'partnerName', (select display_name from public.companion_identities where user_id = partner),
      'partnerTitle', (select title from public.companion_identities where user_id = partner),
      'partnerColor', (select quest_color from public.companion_identities where user_id = partner)
    ),
    'identity', (
      select jsonb_build_object('displayName', display_name, 'title', title, 'questColor', quest_color, 'avatarPath', avatar_path)
      from public.companion_identities where user_id = u
    ),
    'quests', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', q.id, 'title', q.title, 'description', q.description, 'dueOn', q.due_on,
        'rewardText', q.reward_text, 'status', q.status, 'cadence', q.cadence,
        'fromUser', q.from_user, 'toUser', q.to_user, 'instanceId', q.instance_id,
        'createdAt', q.created_at, 'completedAt', q.completed_at,
        'nudgedToday', exists (
          select 1 from public.companion_nudges n where n.quest_id = q.id and n.game_day = v_today
        )
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
    ), '[]'::jsonb),
    'notices', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', n.id, 'kind', n.kind, 'questId', n.quest_id, 'title', q.title,
        'createdAt', n.created_at, 'readAt', n.read_at
      ) order by n.created_at desc)
      from public.companion_notices n
      left join public.companion_quests q on q.id = n.quest_id
      where n.to_user = u and n.bond_id = b.id
    ), '[]'::jsonb),
    'rewards', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', rw.id, 'text', rw.reward_text, 'goal', rw.goal_count,
        'progress', v_week_done, 'unlocked', v_week_done >= rw.goal_count
      ) order by rw.created_at desc)
      from public.companion_rewards rw where rw.bond_id = b.id
    ), '[]'::jsonb),
    'repeats', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', rp.id, 'title', rp.title, 'cadence', rp.cadence, 'weekday', rp.weekday, 'active', rp.active
      ) order by rp.created_at desc)
      from public.companion_repeats rp where rp.bond_id = b.id and rp.deleted_at is null
    ), '[]'::jsonb),
    'recap', jsonb_build_object(
      'visible', pg_catalog.date_part('isodow', v_today) = 7,
      'done', v_week_done, 'streak', v_streak, 'xp', v_xp
    ),
    'milestones', jsonb_build_array(
      jsonb_build_object('key', 'quests-10', 'label', '10 quests together', 'earned', v_done >= 10),
      jsonb_build_object('key', 'quests-50', 'label', '50 quests together', 'earned', v_done >= 50),
      jsonb_build_object('key', 'quests-100', 'label', '100 quests together', 'earned', v_done >= 100),
      jsonb_build_object('key', 'perfect-week', 'label', 'Perfect week of her dailies', 'earned', v_dailies > 0 and v_dailies = v_dailies_done)
    ),
    'tipsSeen', coalesce((
      select jsonb_agg(tip_key) from public.companion_tips where user_id = u
    ), '[]'::jsonb)
  );
end $$;
revoke all on function public.companion_state() from public, anon;
grant execute on function public.companion_state() to authenticated;

drop function if exists public.companion_set_identity(text, text);
create function public.companion_set_identity(p_name text, p_title text, p_color text default 'amber')
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare u uuid := auth.uid(); v_color text := coalesce(p_color, 'amber');
begin
  if u is null then raise exception 'Sign-in required'; end if;
  if not exists (select 1 from public.companion_bonds where status = 'active' and companion_id = u) then
    raise exception 'Companion connection required';
  end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 40 then raise exception 'Invalid name'; end if;
  if p_title not in ('Lantern Keeper','Hearth Warden','Pathfinder','Storyweaver','Dawn Herald') then
    raise exception 'Invalid title';
  end if;
  if v_color not in ('amber','rose','sage','sky','violet') then raise exception 'Invalid color'; end if;
  insert into public.companion_identities(user_id, display_name, title, quest_color)
    values (u, btrim(p_name), p_title, v_color)
    on conflict (user_id) do update
      set display_name = excluded.display_name, title = excluded.title,
          quest_color = excluded.quest_color, updated_at = pg_catalog.now();
  return jsonb_build_object('saved', true, 'displayName', btrim(p_name), 'title', p_title, 'questColor', v_color);
end $$;
revoke all on function public.companion_set_identity(text, text, text) from public, anon;
grant execute on function public.companion_set_identity(text, text, text) to authenticated;

create or replace function public.companion_dismiss_tip(p_key text)
returns void language plpgsql security definer set search_path = ''
as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'Sign-in required'; end if;
  if p_key not in ('izzy-send','izzy-board','izzy-planner','connor-board','connor-proof') then
    raise exception 'Unknown tip';
  end if;
  insert into public.companion_tips(user_id, tip_key) values (u, p_key)
    on conflict (user_id, tip_key) do nothing;
end $$;
revoke all on function public.companion_dismiss_tip(text) from public, anon;
grant execute on function public.companion_dismiss_tip(text) to authenticated;

create or replace function public.companion_nudge(p_quest uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  u uuid := auth.uid();
  q public.companion_quests%rowtype;
  v_day date;
  v_before integer;
begin
  if u is null then raise exception 'Sign-in required'; end if;
  select * into q from public.companion_quests where id = p_quest for update;
  if not found or q.from_user <> u or q.status <> 'accepted' then raise exception 'Quest not found'; end if;
  v_day := public.quest_game_day(pg_catalog.now(), public.quest_timezone(q.to_user));
  select count(*) into v_before from public.xp_ledger where owner_id = q.to_user;
  insert into public.companion_nudges(bond_id, quest_id, game_day) values (q.bond_id, q.id, v_day);
  if (select count(*) from public.xp_ledger where owner_id = q.to_user) <> v_before then
    raise exception 'A nudge must not award XP';
  end if;
  return jsonb_build_object('nudged', true, 'gameDay', v_day);
exception when unique_violation then
  raise exception 'Already nudged today';
end $$;
revoke all on function public.companion_nudge(uuid) from public, anon;
grant execute on function public.companion_nudge(uuid) to authenticated;

create or replace function public.companion_thank(p_quest uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare u uuid := auth.uid(); q public.companion_quests%rowtype; v_before integer;
begin
  if u is null then raise exception 'Sign-in required'; end if;
  select * into q from public.companion_quests where id = p_quest;
  if not found or q.from_user <> u or q.status <> 'completed' then raise exception 'Quest not found'; end if;
  select count(*) into v_before from public.xp_ledger where owner_id in (q.from_user, q.to_user);
  insert into public.companion_notices(bond_id, to_user, quest_id, kind)
    values (q.bond_id, q.to_user, q.id, 'thanks')
    on conflict (quest_id, kind) do nothing;
  if (select count(*) from public.xp_ledger where owner_id in (q.from_user, q.to_user)) <> v_before then
    raise exception 'A thank-you must not award XP';
  end if;
  return jsonb_build_object('thanked', true);
end $$;
revoke all on function public.companion_thank(uuid) from public, anon;
grant execute on function public.companion_thank(uuid) to authenticated;

create or replace function public.companion_mark_notices_read()
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Sign-in required'; end if;
  update public.companion_notices set read_at = pg_catalog.now()
    where to_user = auth.uid() and read_at is null;
end $$;
revoke all on function public.companion_mark_notices_read() from public, anon;
grant execute on function public.companion_mark_notices_read() to authenticated;

create or replace function public.companion_set_reward(p_text text, p_goal integer)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare u uuid := auth.uid(); b uuid; v_id uuid; v_before integer;
begin
  if u is null then raise exception 'Sign-in required'; end if;
  select id into b from public.companion_bonds where status = 'active' and companion_id = u;
  if b is null then raise exception 'Companion connection required'; end if;
  if p_text is null or char_length(btrim(p_text)) not between 1 and 200 then raise exception 'Invalid reward'; end if;
  if p_goal is null or p_goal not between 1 and 100 then raise exception 'Invalid goal'; end if;
  select count(*) into v_before from public.xp_ledger;
  insert into public.companion_rewards(bond_id, reward_text, goal_count, created_by)
    values (b, btrim(p_text), p_goal, u) returning id into v_id;
  if (select count(*) from public.xp_ledger) <> v_before then raise exception 'A reward must not award XP'; end if;
  return jsonb_build_object('rewardId', v_id);
end $$;
revoke all on function public.companion_set_reward(text, integer) from public, anon;
grant execute on function public.companion_set_reward(text, integer) to authenticated;

create or replace function public.companion_save_repeat(p_title text, p_note text, p_weekday integer, p_cadence text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare u uuid := auth.uid(); b uuid; v_id uuid; v_title text := btrim(p_title);
begin
  if u is null then raise exception 'Sign-in required'; end if;
  select id into b from public.companion_bonds where status = 'active' and companion_id = u;
  if b is null then raise exception 'Companion connection required'; end if;
  if v_title is null or char_length(v_title) not between 1 and 120 then raise exception 'Invalid title'; end if;
  if p_weekday is null or p_weekday not between 1 and 7 then raise exception 'Invalid day'; end if;
  if p_cadence not in ('daily','weekly') then raise exception 'Invalid cadence'; end if;
  insert into public.companion_repeats(bond_id, title, description, cadence, weekday, created_by)
    values (b, v_title, nullif(btrim(coalesce(p_note, '')), ''), p_cadence, p_weekday, u)
    returning id into v_id;
  perform public._companion_materialize(b);
  return jsonb_build_object('repeatId', v_id);
end $$;
revoke all on function public.companion_save_repeat(text, text, integer, text) from public, anon;
grant execute on function public.companion_save_repeat(text, text, integer, text) to authenticated;

create or replace function public.companion_pause_repeat(p_repeat uuid, p_active boolean)
returns void language plpgsql security definer set search_path = ''
as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'Sign-in required'; end if;
  update public.companion_repeats r
    set active = coalesce(p_active, false)
    from public.companion_bonds b
    where r.id = p_repeat and r.bond_id = b.id and b.companion_id = u and r.deleted_at is null;
  if not found then raise exception 'Repeat not found'; end if;
end $$;
revoke all on function public.companion_pause_repeat(uuid, boolean) from public, anon;
grant execute on function public.companion_pause_repeat(uuid, boolean) to authenticated;

create or replace function public.companion_delete_repeat(p_repeat uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'Sign-in required'; end if;
  update public.companion_repeats r
    set active = false, deleted_at = pg_catalog.now()
    from public.companion_bonds b
    where r.id = p_repeat and r.bond_id = b.id and b.companion_id = u and r.deleted_at is null;
  if not found then raise exception 'Repeat not found'; end if;
end $$;
revoke all on function public.companion_delete_repeat(uuid) from public, anon;
grant execute on function public.companion_delete_repeat(uuid) to authenticated;

create or replace function public.companion_register_proof(
  p_instance uuid, p_path text, p_type text, p_bytes integer)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  u uuid := auth.uid();
  q public.companion_quests%rowtype;
  v_id uuid;
  v_before integer;
begin
  if u is null then raise exception 'Sign-in required'; end if;
  select * into q from public.companion_quests where instance_id = p_instance;
  if not found or q.to_user <> u or q.status <> 'completed' then raise exception 'Quest not found'; end if;
  if p_type not in ('image/jpeg','image/png','image/webp') then raise exception 'Use a JPEG, PNG, or WebP photo'; end if;
  if p_bytes is null or p_bytes < 1 or p_bytes > 1500000 then raise exception 'Photo is too large'; end if;
  if p_path is distinct from q.bond_id::text || '/' || p_instance::text then raise exception 'Photo path rejected'; end if;
  select count(*) into v_before from public.xp_ledger where owner_id = u;
  insert into public.companion_proofs(bond_id, instance_id, quest_id, uploaded_by, content_type, byte_size, storage_path)
    values (q.bond_id, p_instance, q.id, u, p_type, p_bytes, p_path)
    on conflict (instance_id) do nothing
    returning id into v_id;
  if (select count(*) from public.xp_ledger where owner_id = u) <> v_before then
    raise exception 'A photo must not award XP';
  end if;
  return jsonb_build_object('proofId', v_id, 'already', v_id is null);
end $$;
revoke all on function public.companion_register_proof(uuid, text, text, integer) from public, anon;
grant execute on function public.companion_register_proof(uuid, text, text, integer) to authenticated;

notify pgrst, 'reload schema';
