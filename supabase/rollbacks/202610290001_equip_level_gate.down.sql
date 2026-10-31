-- Reverses 202610290001_equip_level_gate.sql: restores the 202610280001 body
-- of equip_earned_armor (ownership check only) and drops the slot helper.
create or replace function public.equip_earned_armor(p_item_id text, p_equip boolean default true)
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
revoke all on function public.equip_earned_armor(text, boolean) from public, anon;
grant execute on function public.equip_earned_armor(text, boolean) to authenticated;
drop function if exists public.equipment_slot_unlock_xp(text);
