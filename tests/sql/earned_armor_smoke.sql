-- Disposable PostgreSQL integration test; never run against hosted QA or Production.
insert into auth.users(id) values
 ('00000000-0000-0000-0000-00000000ea01'),
 ('00000000-0000-0000-0000-00000000ea02');
insert into public.quests(id, owner_id, title) values
 ('00000000-0000-0000-0000-00000000eb01', '00000000-0000-0000-0000-00000000ea01', 'Earn armor A'),
 ('00000000-0000-0000-0000-00000000eb02', '00000000-0000-0000-0000-00000000ea02', 'Earn armor B');
insert into public.quest_instances(id,owner_id,quest_id,due_date,status,completed_at)
select ('00000000-0000-0000-0000-' || lpad(to_hex(600000 + n), 12, '0'))::uuid,
       '00000000-0000-0000-0000-00000000ea01'::uuid,
       '00000000-0000-0000-0000-00000000eb01'::uuid,
       current_date - n, 'completed', now()
from generate_series(1,9) n;
insert into public.quest_instances(id,owner_id,quest_id,due_date,status,completed_at)
select ('00000000-0000-0000-0000-' || lpad(to_hex(700000 + n), 12, '0'))::uuid,
       '00000000-0000-0000-0000-00000000ea02'::uuid,
       '00000000-0000-0000-0000-00000000eb02'::uuid,
       current_date - n, 'completed', now()
from generate_series(1,10) n;
insert into public.xp_ledger(owner_id,instance_id,amount)
select owner_id,id,1 from public.quest_instances
where owner_id in ('00000000-0000-0000-0000-00000000ea01', '00000000-0000-0000-0000-00000000ea02');
do $$ begin
 if exists(select 1 from public.owned_equipment where owner_id='00000000-0000-0000-0000-00000000ea01') then
  raise exception 'nine XP unlocked armor';
 end if;
 if not exists(select 1 from public.owned_equipment where owner_id='00000000-0000-0000-0000-00000000ea02') then
  raise exception 'ten XP did not unlock armor';
 end if;
 if exists(select 1 from public.equipped_equipment) then
  raise exception 'armor was auto-equipped';
 end if;
 if has_table_privilege('authenticated','public.owned_equipment','insert')
    or has_table_privilege('authenticated','public.equipped_equipment','insert') then
  raise exception 'client can forge equipment';
 end if;
 if has_function_privilege('anon','public.equip_earned_armor(text,boolean)','execute') then
  raise exception 'anon can equip';
 end if;
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000ea01',false);
do $$ begin
 if (public.get_earned_gear()->'ownedItemIds') <> '[]'::jsonb then
  raise exception 'nine-XP account has owned gear';
 end if;
 begin
  perform public.equip_earned_armor('ashen-hood',true);
  raise exception 'unowned equip succeeded';
 exception when others then
  if sqlerrm <> 'Equipment not owned' then raise; end if;
 end;
 begin
  perform public.equip_earned_armor('walking-staff',true);
  raise exception 'unsupported item equipped';
 exception when others then
  if sqlerrm <> 'Unsupported equipment request' then raise; end if;
 end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000ea02',false);
do $$ begin
 if (public.get_earned_gear()->'ownedItemIds') <> '["ashen-hood"]'::jsonb then
  raise exception 'owned gear missing';
 end if;
 if (public.get_earned_gear()->'equippedItemIds') <> '[]'::jsonb then
  raise exception 'gear equipped without action';
 end if;
 perform public.equip_earned_armor('ashen-hood',true);
 if (public.get_earned_gear()->'equippedItemIds') <> '["ashen-hood"]'::jsonb then
  raise exception 'equip did not persist on read';
 end if;
 perform public.equip_earned_armor('ashen-hood',true);
 if (select count(*) from public.equipped_equipment where owner_id=auth.uid()) <> 1 then
  raise exception 'replayed equip duplicated state';
 end if;
end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000ea02',false);
do $$ begin
 if (public.get_earned_gear()->'equippedItemIds') <> '["ashen-hood"]'::jsonb then
  raise exception 'refresh lost equipped gear';
 end if;
 perform public.equip_earned_armor('ashen-hood',false);
 if (public.get_earned_gear()->'equippedItemIds') <> '[]'::jsonb then
  raise exception 'unequip did not persist';
 end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000ea01',false);
do $$ begin
 if (public.get_earned_gear()->'ownedItemIds') <> '[]'::jsonb then
  raise exception 'cross-user ownership leak';
 end if;
 if (select count(*) from public.owned_equipment) <> 0 then
  raise exception 'RLS leaked other owner gear';
 end if;
end $$;
reset role;
insert into public.quest_instances(id,owner_id,quest_id,due_date,status,completed_at)
values ('00000000-0000-0000-0000-00000000ec01',
 '00000000-0000-0000-0000-00000000ea01',
 '00000000-0000-0000-0000-00000000eb01',current_date,'completed',now());
insert into public.xp_ledger(owner_id,instance_id,amount)
values ('00000000-0000-0000-0000-00000000ea01','00000000-0000-0000-0000-00000000ec01',1)
on conflict(instance_id) do nothing;
insert into public.xp_ledger(owner_id,instance_id,amount)
values ('00000000-0000-0000-0000-00000000ea01','00000000-0000-0000-0000-00000000ec01',1)
on conflict(instance_id) do nothing;
do $$ begin
 if (select count(*) from public.owned_equipment where owner_id='00000000-0000-0000-0000-00000000ea01') <> 1 then
  raise exception 'tenth XP grant not exactly once';
 end if;
 if (select count(*) from public.xp_ledger where owner_id='00000000-0000-0000-0000-00000000ea01') <> 10 then
  raise exception 'duplicate XP ledger';
 end if;
end $$;
