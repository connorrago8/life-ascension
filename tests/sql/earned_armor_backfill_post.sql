-- Verify actual migration backfill on existing ledger entries, then trigger behavior.
-- Runs only against a disposable local database; never against hosted QA/Production.
do $$ begin
 if (select count(*) from public.owned_equipment where owner_id = '00000000-0000-0000-0000-00000000fa01' and item_id = 'ashen-hood') <> 1 then
  raise exception 'existing ten-XP owner not backfilled exactly once';
 end if;
 if (select count(*) from public.owned_equipment where owner_id = '00000000-0000-0000-0000-00000000fa02') <> 0 then
  raise exception 'nine-XP owner incorrectly backfilled';
 end if;
 if (select count(*) from public.equipped_equipment) <> 0 then
  raise exception 'historical backfill auto-equipped gear';
 end if;
end $$;
-- The same owner may gain more XP later; backfilled armor must not duplicate.
insert into public.quest_instances(id, owner_id, quest_id, due_date, status, completed_at)
values ('00000000-0000-0000-0000-00000000fc01',
 '00000000-0000-0000-0000-00000000fa01',
 '00000000-0000-0000-0000-00000000fb01', current_date - 11, 'completed', now());
insert into public.xp_ledger(owner_id, instance_id, amount)
values ('00000000-0000-0000-0000-00000000fa01', '00000000-0000-0000-0000-00000000fc01', 1)
on conflict (instance_id) do nothing;
-- Nine-XP user earns the tenth only after migration and must receive one item.
insert into public.quest_instances(id, owner_id, quest_id, due_date, status, completed_at)
values ('00000000-0000-0000-0000-00000000fc02',
 '00000000-0000-0000-0000-00000000fa02',
 '00000000-0000-0000-0000-00000000fb02', current_date - 10, 'completed', now());
insert into public.xp_ledger(owner_id, instance_id, amount)
values ('00000000-0000-0000-0000-00000000fa02', '00000000-0000-0000-0000-00000000fc02', 1)
on conflict (instance_id) do nothing;
insert into public.xp_ledger(owner_id, instance_id, amount)
values ('00000000-0000-0000-0000-00000000fa02', '00000000-0000-0000-0000-00000000fc02', 1)
on conflict (instance_id) do nothing;
do $$ begin
 if (select count(*) from public.owned_equipment where owner_id = '00000000-0000-0000-0000-00000000fa01') <> 1
 or (select count(*) from public.owned_equipment where owner_id = '00000000-0000-0000-0000-00000000fa02') <> 1 then
  raise exception 'later XP grant duplicated or failed ownership';
 end if;
 if (select count(*) from public.xp_ledger where owner_id = '00000000-0000-0000-0000-00000000fa01') <> 11
 or (select count(*) from public.xp_ledger where owner_id = '00000000-0000-0000-0000-00000000fa02') <> 10 then
  raise exception 'replayed ledger XP duplicated';
 end if;
 if exists (select 1 from public.equipped_equipment) then
  raise exception 'backfill or trigger auto-equipped gear';
 end if;
end $$;
