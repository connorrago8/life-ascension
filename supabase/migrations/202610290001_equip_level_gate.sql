-- Additive and reversible (see supabase/rollbacks/202610290001_equip_level_gate.down.sql).
-- Adds a server-side level gate to the existing owner-checked equip path.
-- No table, RLS policy, grant or XP rule changes. Ownership is still granted
-- only by the XP-ledger trigger; this function can only equip owned items.
--
-- Approved slots (PR #12) and unlock levels. Cumulative XP to reach level N
-- is 5 * (N * (N + 1) - 2) / 2 (lib/level.ts): Lv1 0, Lv3 25, Lv5 70, Lv10 270, Lv15 595.
create function public.equipment_slot_unlock_xp(p_slot text)
returns bigint language sql immutable set search_path = '' as $$
  select (case p_slot
    when 'weapon' then 0
    when 'armor' then 0
    when 'headwear' then 25
    when 'shield' then 70
    when 'cloak' then 270
    when 'companion' then 595
  end)::bigint;
$$;
revoke all on function public.equipment_slot_unlock_xp(text) from public, anon, authenticated;

-- Same signature, grants and ownership checks as 202610280001_earned_armor.sql,
-- plus: equipping requires the owner's verified lifetime XP to reach the slot's
-- unlock level. Unequipping is always allowed so nobody is stuck wearing gear.
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
    -- Ashen Hood is headwear (DB slot 'head'), which unlocks at level 3.
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
