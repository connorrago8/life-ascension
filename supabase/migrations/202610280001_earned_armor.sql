-- Source-only candidate: Alpha security review and separate hosted-migration authorization required.
-- XP ledger inserts are the sole grant authority. No client-side XP threshold grants gear.
create table public.owned_equipment (
  owner_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null check (item_id = 'ashen-hood'),
  source text not null default 'quest_xp_10' check (source = 'quest_xp_10'),
  earned_at timestamptz not null default now(),
  primary key (owner_id, item_id)
);
create table public.equipped_equipment (
  owner_id uuid not null references auth.users(id) on delete cascade,
  slot text not null check (slot = 'head'),
  item_id text not null check (item_id = 'ashen-hood'),
  equipped_at timestamptz not null default now(),
  primary key (owner_id, slot),
  foreign key (owner_id, item_id) references public.owned_equipment(owner_id, item_id) on delete cascade
);
alter table public.owned_equipment enable row level security;
alter table public.equipped_equipment enable row level security;
create policy owned_equipment_read on public.owned_equipment
  for select to authenticated using (owner_id = (select auth.uid()));
create policy equipped_equipment_read on public.equipped_equipment
  for select to authenticated using (owner_id = (select auth.uid()));
revoke all on public.owned_equipment, public.equipped_equipment from public, anon, authenticated;
grant select on public.owned_equipment, public.equipped_equipment to authenticated;

-- Serialize per-user grant checks so concurrent ninth/tenth XP events cannot miss the award.
create function public.grant_ashen_hood_from_xp()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.owner_id::text, 20261028));
  if (select pg_catalog.count(*) from public.xp_ledger where owner_id = new.owner_id) >= 10 then
    insert into public.owned_equipment(owner_id, item_id)
      values (new.owner_id, 'ashen-hood') on conflict do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.grant_ashen_hood_from_xp() from public, anon, authenticated;
create trigger grant_ashen_hood_on_ledger_insert
  after insert on public.xp_ledger for each row
  execute function public.grant_ashen_hood_from_xp();

-- Existing accounts with 10+ verified ledger entries also earn the item; never auto-equip.
insert into public.owned_equipment(owner_id, item_id)
select owner_id, 'ashen-hood' from public.xp_ledger
group by owner_id having pg_catalog.count(*) >= 10
on conflict do nothing;

create function public.get_earned_gear()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select pg_catalog.jsonb_build_object(
    'ownedItemIds', coalesce((select pg_catalog.jsonb_agg(o.item_id order by o.item_id)
      from public.owned_equipment o where o.owner_id = (select auth.uid())), '[]'::jsonb),
    'equippedItemIds', coalesce((select pg_catalog.jsonb_agg(e.item_id order by e.item_id)
      from public.equipped_equipment e where e.owner_id = (select auth.uid())), '[]'::jsonb)
  );
$$;

create function public.equip_earned_armor(p_item_id text, p_equip boolean default true)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_owner uuid;
begin
  v_owner := auth.uid();
  if v_owner is null then raise exception 'Authentication required'; end if;
  if p_item_id is distinct from 'ashen-hood' or p_equip is null then
    raise exception 'Unsupported equipment request';
  end if;
  if p_equip then
    if not exists (select 1 from public.owned_equipment
      where owner_id = v_owner and item_id = p_item_id) then
      raise exception 'Equipment not owned';
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
end;
$$;
revoke all on function public.get_earned_gear(), public.equip_earned_armor(text, boolean)
  from public, anon;
grant execute on function public.get_earned_gear(), public.equip_earned_armor(text, boolean)
  to authenticated;
