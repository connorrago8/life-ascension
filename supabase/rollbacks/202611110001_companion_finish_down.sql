-- Reverse 202611110001. Does not reopen companion quests whose instance is already completed,
-- and does not give the Ashen Hood back to a companion account.
begin;

drop trigger if exists companion_quest_status_on_instance on public.quest_instances;
drop function if exists public.sync_companion_quest_from_instance();
drop function if exists public.companion_home_metrics();
drop function if exists public.companion_mark_cosmetics_seen();
drop function if exists public.companion_wear_cosmetic(text, boolean);
drop function if exists public.companion_wardrobe();
drop function if exists public._companion_wardrobe_payload(uuid);
drop function if exists public._companion_grant_unlocked(uuid);
drop table if exists public.companion_worn_cosmetics;
drop table if exists public.companion_owned_cosmetics;
drop table if exists public.companion_cosmetic_catalog;
drop function if exists public._companion_lifetime_xp(uuid);
drop function if exists public.companion_level_for_xp(bigint);

create or replace function public.grant_ashen_hood_from_xp()
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

create or replace function public.equip_earned_armor(p_item_id text, p_equip boolean default true)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid;
  v_xp bigint;
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
end;
$$;
revoke all on function public.equip_earned_armor(text, boolean) from public, anon;
grant execute on function public.equip_earned_armor(text, boolean) to authenticated;

notify pgrst, 'reload schema';
commit;
