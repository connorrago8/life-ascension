-- Disposable pre-migration fixture. Run only in a cloned local PostgreSQL database.
-- A already has 10 ledger-confirmed XP; B has 9 and must not receive armor.
insert into auth.users(id) values
 ('00000000-0000-0000-0000-00000000fa01'),
 ('00000000-0000-0000-0000-00000000fa02');
insert into public.quests(id, owner_id, title) values
 ('00000000-0000-0000-0000-00000000fb01', '00000000-0000-0000-0000-00000000fa01', 'Historical XP A'),
 ('00000000-0000-0000-0000-00000000fb02', '00000000-0000-0000-0000-00000000fa02', 'Historical XP B');
insert into public.quest_instances(id, owner_id, quest_id, due_date, status, completed_at)
select ('00000000-0000-0000-0000-' || lpad(to_hex(800000 + n), 12, '0'))::uuid,
       '00000000-0000-0000-0000-00000000fa01'::uuid,
       '00000000-0000-0000-0000-00000000fb01'::uuid,
       current_date - n, 'completed', now()
from generate_series(1, 10) n;
insert into public.quest_instances(id, owner_id, quest_id, due_date, status, completed_at)
select ('00000000-0000-0000-0000-' || lpad(to_hex(900000 + n), 12, '0'))::uuid,
       '00000000-0000-0000-0000-00000000fa02'::uuid,
       '00000000-0000-0000-0000-00000000fb02'::uuid,
       current_date - n, 'completed', now()
from generate_series(1, 9) n;
insert into public.xp_ledger(owner_id, instance_id, amount)
select owner_id, id, 1 from public.quest_instances
where owner_id in ('00000000-0000-0000-0000-00000000fa01',
                   '00000000-0000-0000-0000-00000000fa02');
do $$ begin
 if (select count(*) from public.xp_ledger where owner_id = '00000000-0000-0000-0000-00000000fa01') <> 10 then
  raise exception 'historical ten-XP fixture invalid';
 end if;
 if (select count(*) from public.xp_ledger where owner_id = '00000000-0000-0000-0000-00000000fa02') <> 9 then
  raise exception 'historical nine-XP fixture invalid';
 end if;
 if to_regclass('public.owned_equipment') is not null then
  raise exception 'fixture ran after armor migration';
 end if;
end $$;
