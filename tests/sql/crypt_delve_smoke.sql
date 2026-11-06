-- Disposable PostgreSQL test for 202610300001_crypt_delve.sql; never run against hosted QA or Production.
-- User c1: 3 real quests completed today (cap 3 tenths), 12 lifetime XP (level 2 -> 11 points).
-- User c2: no XP at all (cap 0).
insert into auth.users(id) values ('00000000-0000-0000-0000-0000000c0001'), ('00000000-0000-0000-0000-0000000c0002');
insert into public.quests(id, owner_id, title) values
 ('00000000-0000-0000-0000-0000000c0101', '00000000-0000-0000-0000-0000000c0001', 'Crypt smoke quest');
insert into public.quest_instances(id,owner_id,quest_id,due_date,status,completed_at)
select ('00000000-0000-0000-0000-' || lpad(to_hex(800000 + n), 12, '0'))::uuid,
       '00000000-0000-0000-0000-0000000c0001'::uuid, '00000000-0000-0000-0000-0000000c0101'::uuid,
       current_date - n, 'completed', now()
from generate_series(1,12) n;
insert into public.xp_ledger(owner_id,instance_id,amount,awarded_at)
select owner_id, id, 1, case when due_date >= current_date - 3 then now() else now() - interval '10 days' end
from public.quest_instances where owner_id = '00000000-0000-0000-0000-0000000c0001';
do $$ begin
 if has_table_privilege('authenticated','public.crypt_loot','insert')
    or has_table_privilege('authenticated','public.crypt_xp_daily','insert')
    or has_table_privilege('authenticated','public.crypt_xp_daily','update')
    or has_table_privilege('authenticated','public.crypt_hero','update') then
  raise exception 'client can write crypt tables directly';
 end if;
 if has_function_privilege('anon','public.record_crypt_floor_clear(uuid,integer)','execute')
    or has_function_privilege('authenticated','public.crypt_level_for_owner(uuid)','execute') then
  raise exception 'unsafe crypt function grant';
 end if;
end $$;
create temp table xp_before as select owner_id, count(*) n, sum(amount) total from public.xp_ledger group by owner_id;
grant select on xp_before to authenticated;

set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000c0001',false);
do $$ declare r jsonb; begin
 -- Level 2 (12 XP) allows 7 + 2*2 = 11 points across STR, AGI, INT, END, LCK.
 r := public.set_crypt_attributes(4, 2, 2, 2, 1);
 if (r->>'points')::int <> 11 then raise exception 'wrong point budget: %', r; end if;
 begin
  perform public.set_crypt_attributes(4, 2, 2, 2, 2);
  raise exception 'overspent allocation accepted';
 exception when others then if sqlerrm <> 'Not enough attribute points' then raise; end if; end;
 begin
  perform public.set_crypt_attributes(-1, 3, 3, 2, 2);
  raise exception 'negative allocation accepted';
 exception when others then if sqlerrm <> 'Invalid attribute allocation' then raise; end if; end;

 if not public.claim_crypt_loot('00000000-0000-0000-0000-00000000aa01', 0, 'bone-cleaver') then raise exception 'claim failed'; end if;
 if public.claim_crypt_loot('00000000-0000-0000-0000-00000000aa01', 0, 'warden-glaive') then raise exception 'drop index replayed'; end if;
 begin
  perform public.claim_crypt_loot('00000000-0000-0000-0000-00000000aa01', 1, 'golden-xp-sword');
  raise exception 'unknown item claimed';
 exception when check_violation then null; end;

 -- Cap is 3 tenths today. Floor 1 asks 1, floor 2 asks 2, floor 3 asks 3 (only 0 left).
 r := public.record_crypt_floor_clear('00000000-0000-0000-0000-00000000aa01', 1);
 if (r->>'tenthsAwarded')::int <> 1 or (r->>'capToday')::int <> 3 then raise exception 'floor 1 award wrong: %', r; end if;
 r := public.record_crypt_floor_clear('00000000-0000-0000-0000-00000000aa01', 1);
 if (r->>'tenthsAwarded')::int <> 0 or (r->>'firstClear')::boolean then raise exception 'replayed clear awarded: %', r; end if;
 r := public.record_crypt_floor_clear('00000000-0000-0000-0000-00000000aa02', 2);
 if (r->>'tenthsAwarded')::int <> 2 then raise exception 'floor 2 award wrong: %', r; end if;
 r := public.record_crypt_floor_clear('00000000-0000-0000-0000-00000000aa03', 3);
 if (r->>'tenthsAwarded')::int <> 0 or (r->>'tenthsToday')::int <> 3 then raise exception 'cap not enforced: %', r; end if;
 if public.get_crypt_xp() <> 0 then raise exception '3 tenths must be 0 whole Crypt XP'; end if;
 r := public.get_crypt_profile();
 if (r->'vaultItemIds') <> '["bone-cleaver"]'::jsonb or (r->>'deepestFloor')::int <> 3 or (r->'attributes'->>'strength')::int <> 4
    or (r->'attributes'->>'agility')::int <> 2 or (r->'attributes'->>'luck')::int <> 1 or (select count(*) from jsonb_object_keys(r->'attributes')) <> 5 then
  raise exception 'profile wrong: %', r;
 end if;
end $$;

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000c0002',false);
do $$ declare r jsonb; begin
 r := public.record_crypt_floor_clear('00000000-0000-0000-0000-00000000bb01', 5);
 if (r->>'tenthsAwarded')::int <> 0 then raise exception 'no-quest user earned Crypt XP: %', r; end if;
 if (public.get_crypt_profile()->'vaultItemIds') <> '[]'::jsonb then raise exception 'saw another user''s loot'; end if;
 if exists(select 1 from public.crypt_loot) then raise exception 'RLS leak on crypt_loot'; end if;
 begin
  perform public.set_crypt_attributes(5, 5, 0, 0, 0);
  raise exception 'level-1 user overspent';
 exception when others then if sqlerrm <> 'Not enough attribute points' then raise; end if; end;
end $$;
reset role;

do $$ begin
 if exists (select 1 from public.xp_ledger l join xp_before b using (owner_id) group by l.owner_id, b.n having count(*) <> b.n) then
  raise exception 'Crypt changed xp_ledger';
 end if;
 if (select count(*) from public.xp_ledger) <> 12 then raise exception 'Crypt inserted real XP'; end if;
end $$;
select 'crypt delve smoke passed' as result;
