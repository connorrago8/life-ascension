-- Companion status stays with the quest instance, and Izzy's clothes come from her XP.
-- Additive. Reverse with supabase/rollbacks/202611110001_companion_finish_down.sql.
-- Crypt XP is not touched. Clothes grant no combat stats.

create or replace function public.sync_companion_quest_from_instance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    update public.companion_quests
      set status = 'completed',
          completed_at = coalesce(completed_at, new.completed_at, pg_catalog.now())
      where instance_id = new.id
        and status in ('accepted', 'sent');
  end if;
  return new;
end $$;
revoke all on function public.sync_companion_quest_from_instance() from public, anon, authenticated, service_role;

drop trigger if exists companion_quest_status_on_instance on public.quest_instances;
create trigger companion_quest_status_on_instance
  after update of status on public.quest_instances
  for each row
  execute function public.sync_companion_quest_from_instance();

update public.companion_quests q
  set status = 'completed',
      completed_at = coalesce(q.completed_at, i.completed_at, pg_catalog.now())
  from public.quest_instances i
  where q.instance_id = i.id
    and i.status = 'completed'
    and q.status in ('accepted', 'sent');

create or replace function public.companion_home_metrics()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  u uuid := auth.uid();
  b public.companion_bonds%rowtype;
  v_today date;
  v_week date;
  v_open integer := 0;
  v_done integer := 0;
begin
  if u is null then raise exception 'Sign-in required'; end if;
  update public.companion_quests q
    set status = 'completed',
        completed_at = coalesce(q.completed_at, i.completed_at, pg_catalog.now())
    from public.quest_instances i
    where q.instance_id = i.id
      and i.status = 'completed'
      and q.status in ('accepted', 'sent')
      and u in (q.from_user, q.to_user);
  select * into b from public.companion_bonds
    where status = 'active' and u in (inviter_id, companion_id)
    order by created_at desc
    limit 1;
  if not found then
    return jsonb_build_object('openQuests', 0, 'doneThisWeek', 0);
  end if;
  v_today := public.quest_game_day(pg_catalog.now(), public.quest_timezone(b.inviter_id));
  v_week := public.quest_week_start(v_today);
  select count(*) filter (where status <> 'declined' and status <> 'completed'),
         count(*) filter (where status = 'completed' and due_on >= v_week and due_on < (v_week + 7))
    into v_open, v_done
    from public.companion_quests
    where bond_id = b.id and from_user = u;
  return jsonb_build_object('openQuests', v_open, 'doneThisWeek', v_done);
end $$;
revoke all on function public.companion_home_metrics() from public, anon;
grant execute on function public.companion_home_metrics() to authenticated;

-- Same curve as lib/level.ts: XP to reach level n is 5 * (n * (n + 1) - 2) / 2.
create function public.companion_level_for_xp(p_xp bigint)
returns integer
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_level integer := 1;
  v_xp bigint := greatest(coalesce(p_xp, 0), 0);
  v_need bigint;
begin
  while v_level < 500 loop
    v_need := 5 * ((((v_level + 1)::bigint * (v_level + 2)) - 2) / 2);
    exit when v_need > v_xp;
    v_level := v_level + 1;
  end loop;
  return v_level;
end $$;
revoke all on function public.companion_level_for_xp(bigint) from public, anon, authenticated, service_role;

create function public._companion_lifetime_xp(p_owner uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select (
    coalesce((select sum(amount) from public.xp_ledger where owner_id = p_owner), 0)
    + coalesce((select sum(amount) from public.xp_ledger_adjustments where owner_id = p_owner), 0)
  )::bigint
$$;
revoke all on function public._companion_lifetime_xp(uuid) from public, anon, authenticated, service_role;

create table public.companion_cosmetic_catalog (
  id text primary key,
  label text not null,
  slot text not null check (slot in ('accent', 'shirt', 'pin', 'head', 'gown')),
  unlock_level integer not null check (unlock_level >= 1),
  sort_order integer not null unique
);
insert into public.companion_cosmetic_catalog(id, label, slot, unlock_level, sort_order) values
  ('ribbon', 'Ribbon', 'accent', 2, 1),
  ('black-shirt', 'Black shirt', 'shirt', 5, 2),
  ('lantern-pin', 'Lantern pin', 'pin', 10, 3),
  ('cat-ears', 'Cat ears', 'head', 25, 4),
  ('princess', 'Princess', 'gown', 50, 5);
alter table public.companion_cosmetic_catalog enable row level security;
create policy companion_catalog_read on public.companion_cosmetic_catalog
  for select to authenticated using (true);
revoke all on public.companion_cosmetic_catalog from public, anon, authenticated;
grant select on public.companion_cosmetic_catalog to authenticated;

create table public.companion_owned_cosmetics (
  owner_id uuid not null references auth.users(id) on delete cascade,
  cosmetic_id text not null references public.companion_cosmetic_catalog(id),
  unlocked_at timestamptz not null default pg_catalog.now(),
  celebrated_at timestamptz,
  primary key (owner_id, cosmetic_id)
);
alter table public.companion_owned_cosmetics enable row level security;
create policy companion_owned_read on public.companion_owned_cosmetics
  for select to authenticated using (owner_id = (select auth.uid()));
revoke all on public.companion_owned_cosmetics from public, anon, authenticated;
grant select on public.companion_owned_cosmetics to authenticated;

create table public.companion_worn_cosmetics (
  owner_id uuid not null references auth.users(id) on delete cascade,
  slot text not null,
  cosmetic_id text not null,
  worn_at timestamptz not null default pg_catalog.now(),
  primary key (owner_id, slot),
  foreign key (owner_id, cosmetic_id)
    references public.companion_owned_cosmetics(owner_id, cosmetic_id) on delete cascade
);
alter table public.companion_worn_cosmetics enable row level security;
create policy companion_worn_read on public.companion_worn_cosmetics
  for select to authenticated using (owner_id = (select auth.uid()));
revoke all on public.companion_worn_cosmetics from public, anon, authenticated;
grant select on public.companion_worn_cosmetics to authenticated;

create function public._companion_grant_unlocked(p_owner uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_level integer;
begin
  v_level := public.companion_level_for_xp(public._companion_lifetime_xp(p_owner));
  insert into public.companion_owned_cosmetics(owner_id, cosmetic_id)
  select p_owner, c.id
    from public.companion_cosmetic_catalog c
    where c.unlock_level <= v_level
  on conflict do nothing;
end $$;
revoke all on function public._companion_grant_unlocked(uuid) from public, anon, authenticated, service_role;

create function public._companion_wardrobe_payload(p_owner uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'level', public.companion_level_for_xp(public._companion_lifetime_xp(p_owner)),
    'xp', public._companion_lifetime_xp(p_owner),
    'xpForNext', 5 * (public.companion_level_for_xp(public._companion_lifetime_xp(p_owner)) + 1),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id,
        'label', c.label,
        'slot', c.slot,
        'unlockLevel', c.unlock_level,
        'owned', o.owner_id is not null,
        'worn', w.owner_id is not null,
        'fresh', o.owner_id is not null and o.celebrated_at is null
      ) order by c.sort_order)
      from public.companion_cosmetic_catalog c
      left join public.companion_owned_cosmetics o
        on o.cosmetic_id = c.id and o.owner_id = p_owner
      left join public.companion_worn_cosmetics w
        on w.cosmetic_id = c.id and w.owner_id = p_owner
    ), '[]'::jsonb)
  )
$$;
revoke all on function public._companion_wardrobe_payload(uuid) from public, anon, authenticated, service_role;

create function public.companion_wardrobe()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'Sign-in required'; end if;
  if not exists (
    select 1 from public.companion_bonds where status = 'active' and companion_id = u
  ) then
    raise exception 'Companion connection required';
  end if;
  perform public._companion_grant_unlocked(u);
  return public._companion_wardrobe_payload(u);
end $$;
revoke all on function public.companion_wardrobe() from public, anon;
grant execute on function public.companion_wardrobe() to authenticated;

create function public.companion_wear_cosmetic(p_id text, p_wear boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare u uuid := auth.uid(); v_slot text;
begin
  if u is null then raise exception 'Sign-in required'; end if;
  if p_wear is null then raise exception 'Unsupported cosmetic'; end if;
  if not exists (
    select 1 from public.companion_bonds where status = 'active' and companion_id = u
  ) then
    raise exception 'Companion connection required';
  end if;
  perform public._companion_grant_unlocked(u);
  select slot into v_slot from public.companion_cosmetic_catalog where id = p_id;
  if v_slot is null then raise exception 'Unsupported cosmetic'; end if;
  if not exists (
    select 1 from public.companion_owned_cosmetics where owner_id = u and cosmetic_id = p_id
  ) then
    raise exception 'Cosmetic not owned';
  end if;
  if p_wear then
    insert into public.companion_worn_cosmetics(owner_id, slot, cosmetic_id)
      values (u, v_slot, p_id)
      on conflict (owner_id, slot) do update
        set cosmetic_id = excluded.cosmetic_id, worn_at = pg_catalog.now();
  else
    delete from public.companion_worn_cosmetics
      where owner_id = u and cosmetic_id = p_id;
  end if;
  return public._companion_wardrobe_payload(u);
end $$;
revoke all on function public.companion_wear_cosmetic(text, boolean) from public, anon;
grant execute on function public.companion_wear_cosmetic(text, boolean) to authenticated;

create function public.companion_mark_cosmetics_seen()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'Sign-in required'; end if;
  if not exists (
    select 1 from public.companion_bonds where status = 'active' and companion_id = u
  ) then
    raise exception 'Companion connection required';
  end if;
  update public.companion_owned_cosmetics
    set celebrated_at = pg_catalog.now()
    where owner_id = u and celebrated_at is null;
end $$;
revoke all on function public.companion_mark_cosmetics_seen() from public, anon;
grant execute on function public.companion_mark_cosmetics_seen() to authenticated;

create or replace function public.grant_ashen_hood_from_xp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.companion_bonds
    where status = 'active' and companion_id = new.owner_id
  ) then
    return new;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.owner_id::text, 20261028));
  if (select pg_catalog.count(*) from public.xp_ledger where owner_id = new.owner_id) >= 10 then
    insert into public.owned_equipment(owner_id, item_id)
      values (new.owner_id, 'ashen-hood') on conflict do nothing;
  end if;
  return new;
end $$;
revoke all on function public.grant_ashen_hood_from_xp() from public, anon, authenticated;

create or replace function public.equip_earned_armor(p_item_id text, p_equip boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_xp bigint;
begin
  v_owner := auth.uid();
  if v_owner is null then raise exception 'Authentication required'; end if;
  if exists (
    select 1 from public.companion_bonds where status = 'active' and companion_id = v_owner
  ) then
    raise exception 'Companion accounts do not use adventurer gear';
  end if;
  if p_item_id is distinct from 'ashen-hood' or p_equip is null then
    raise exception 'Unsupported equipment request';
  end if;
  if p_equip then
    if not exists (select 1 from public.owned_equipment
      where owner_id = v_owner and item_id = p_item_id) then
      raise exception 'Equipment not owned';
    end if;
    select coalesce(pg_catalog.sum(amount), 0)::bigint into v_xp
      from public.xp_ledger where owner_id = v_owner;
    if v_xp < public.equipment_slot_unlock_xp('headwear') then
      raise exception 'Slot locked';
    end if;
    insert into public.equipped_equipment(owner_id, slot, item_id)
      values (v_owner, 'head', p_item_id)
      on conflict (owner_id, slot) do update
        set item_id = excluded.item_id, equipped_at = now();
  else
    delete from public.equipped_equipment
      where owner_id = v_owner and slot = 'head' and item_id = p_item_id;
  end if;
  return public.get_earned_gear();
end $$;
revoke all on function public.equip_earned_armor(text, boolean) from public, anon;
grant execute on function public.equip_earned_armor(text, boolean) to authenticated;

delete from public.equipped_equipment e
  using public.companion_bonds b
  where e.owner_id = b.companion_id and b.status = 'active' and e.item_id = 'ashen-hood';
delete from public.owned_equipment o
  using public.companion_bonds b
  where o.owner_id = b.companion_id and b.status = 'active' and o.item_id = 'ashen-hood';

notify pgrst, 'reload schema';
