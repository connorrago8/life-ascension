-- Disposable PostgreSQL integration test; never run against hosted QA or Production.
-- Requires 202610280001_earned_armor.sql and 202610290001_equip_level_gate.sql.
insert into auth.users(id) values
 ('00000000-0000-0000-0000-00000000fa01'),
 ('00000000-0000-0000-0000-00000000fa02'),
 ('00000000-0000-0000-0000-00000000fa03');
insert into public.quests(id, owner_id, title) values
 ('00000000-0000-0000-0000-00000000fb01', '00000000-0000-0000-0000-00000000fa01', 'Gate L2'),
 ('00000000-0000-0000-0000-00000000fb02', '00000000-0000-0000-0000-00000000fa02', 'Gate L3'),
 ('00000000-0000-0000-0000-00000000fb03', '00000000-0000-0000-0000-00000000fa03', 'Gate none');
-- fa01: 24 XP (Lv 2, owns hood). fa02: 25 XP (Lv 3, owns hood). fa03: 3 XP (owns nothing).
insert into public.quest_instances(id,owner_id,quest_id,due_date,status,completed_at)
select ('00000000-0000-0000-0000-' || lpad(to_hex(800000 + n), 12, '0'))::uuid,
       '00000000-0000-0000-0000-00000000fa01'::uuid, '00000000-0000-0000-0000-00000000fb01'::uuid,
       current_date - n, 'completed', now()
from generate_series(1,24) n;
insert into public.quest_instances(id,owner_id,quest_id,due_date,status,completed_at)
select ('00000000-0000-0000-0000-' || lpad(to_hex(900000 + n), 12, '0'))::uuid,
       '00000000-0000-0000-0000-00000000fa02'::uuid, '00000000-0000-0000-0000-00000000fb02'::uuid,
       current_date - n, 'completed', now()
from generate_series(1,25) n;
insert into public.quest_instances(id,owner_id,quest_id,due_date,status,completed_at)
select ('00000000-0000-0000-0000-' || lpad(to_hex(990000 + n), 12, '0'))::uuid,
       '00000000-0000-0000-0000-00000000fa03'::uuid, '00000000-0000-0000-0000-00000000fb03'::uuid,
       current_date - n, 'completed', now()
from generate_series(1,3) n;
insert into public.xp_ledger(owner_id,instance_id,amount)
select owner_id,id,1 from public.quest_instances
where owner_id in ('00000000-0000-0000-0000-00000000fa01','00000000-0000-0000-0000-00000000fa02','00000000-0000-0000-0000-00000000fa03');
do $$ begin
 if public.equipment_slot_unlock_xp('weapon') <> 0 or public.equipment_slot_unlock_xp('armor') <> 0
    or public.equipment_slot_unlock_xp('headwear') <> 25 or public.equipment_slot_unlock_xp('shield') <> 70
    or public.equipment_slot_unlock_xp('cloak') <> 270 or public.equipment_slot_unlock_xp('companion') <> 595 then
  raise exception 'slot unlock XP table drifted from lib/level.ts';
 end if;
 if public.equipment_slot_unlock_xp('legs') is not null then
  raise exception 'unknown slot must not unlock';
 end if;
 if has_function_privilege('anon','public.equip_earned_armor(text,boolean)','execute') then
  raise exception 'anon can equip';
 end if;
 if has_function_privilege('authenticated','public.equipment_slot_unlock_xp(text)','execute')
    or has_function_privilege('anon','public.equipment_slot_unlock_xp(text)','execute') then
  raise exception 'helper exposed to clients';
 end if;
 if has_table_privilege('authenticated','public.equipped_equipment','insert')
    or has_table_privilege('authenticated','public.owned_equipment','insert') then
  raise exception 'client can forge equipment';
 end if;
end $$;
-- Simulate a pre-gate equip for fa01 so unequip-while-locked is covered.
insert into public.equipped_equipment(owner_id, slot, item_id)
values ('00000000-0000-0000-0000-00000000fa01','head','ashen-hood');
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000fa01',false);
do $$ begin
 if (public.get_earned_gear()->'ownedItemIds') <> '["ashen-hood"]'::jsonb then
  raise exception 'Lv2 account should own hood';
 end if;
 perform public.equip_earned_armor('ashen-hood',false);
 if (public.get_earned_gear()->'equippedItemIds') <> '[]'::jsonb then
  raise exception 'unequip while locked must succeed';
 end if;
 begin
  perform public.equip_earned_armor('ashen-hood',true);
  raise exception 'locked headwear equipped below Lv3';
 exception when others then
  if sqlerrm <> 'Slot locked' then raise; end if;
 end;
 if (public.get_earned_gear()->'equippedItemIds') <> '[]'::jsonb then
  raise exception 'locked equip left state behind';
 end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000fa03',false);
do $$ begin
 begin
  perform public.equip_earned_armor('ashen-hood',true);
  raise exception 'unowned equip succeeded';
 exception when others then
  if sqlerrm <> 'Equipment not owned' then raise; end if;
 end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000fa02',false);
do $$ begin
 perform public.equip_earned_armor('ashen-hood',true);
 if (public.get_earned_gear()->'equippedItemIds') <> '["ashen-hood"]'::jsonb then
  raise exception 'Lv3 owner could not equip headwear';
 end if;
 perform public.equip_earned_armor('ashen-hood',false);
 if (public.get_earned_gear()->'equippedItemIds') <> '[]'::jsonb then
  raise exception 'Lv3 unequip did not persist';
 end if;
 begin
  perform public.equip_earned_armor('walking-staff',true);
  raise exception 'unsupported item equipped';
 exception when others then
  if sqlerrm <> 'Unsupported equipment request' then raise; end if;
 end;
end $$;
reset role;
do $$ begin
 if (select count(*) from public.xp_ledger where owner_id='00000000-0000-0000-0000-00000000fa02') <> 25 then
  raise exception 'equip path changed XP';
 end if;
end $$;
select 'equip level gate smoke passed';
