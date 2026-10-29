-- LIFE ASCENSION 0.3: read-only, POST-migration QA acceptance gate.
-- Run ONLY on independently confirmed QA project njqwwimzrsunheehnnnt,
-- after Founder-authorized receipt-v2 then earned-armor migrations.
-- Do not run as a migration. No DDL, writes, credentials, user identifiers,
-- or destructive rollback. A PASS is not browser/runtime/iPhone acceptance.
-- For a failed check: halt rollout; preserve data and inspect the failure.
-- Do not DROP new tables or reverse the backfill without a verified recovery
-- point and separate Founder authorization. Prefer a reviewed forward repair.
WITH checks(name, passed) AS (
 VALUES
 ('receipt_v2_present',
  to_regprocedure('public.set_quest_instance_status_v2(uuid,text)') IS NOT NULL),
 ('receipt_v2_security_definer',
  COALESCE((SELECT prosecdef FROM pg_proc WHERE oid =
    to_regprocedure('public.set_quest_instance_status_v2(uuid,text)')), false)),
 ('receipt_v2_authenticated_only',
  COALESCE(has_function_privilege('authenticated',
    to_regprocedure('public.set_quest_instance_status_v2(uuid,text)'), 'EXECUTE'), false)
  AND NOT COALESCE(has_function_privilege('anon',
    to_regprocedure('public.set_quest_instance_status_v2(uuid,text)'), 'EXECUTE'), false)),
 ('owned_equipment_rls',
  COALESCE((SELECT relrowsecurity FROM pg_class WHERE oid =
    to_regclass('public.owned_equipment')), false)),
 ('equipped_equipment_rls',
  COALESCE((SELECT relrowsecurity FROM pg_class WHERE oid =
    to_regclass('public.equipped_equipment')), false)),
 ('authenticated_equipment_read_only',
  COALESCE(has_table_privilege('authenticated','public.owned_equipment','SELECT'), false)
  AND COALESCE(has_table_privilege('authenticated','public.equipped_equipment','SELECT'), false)
  AND NOT COALESCE(has_table_privilege('authenticated','public.owned_equipment','INSERT,UPDATE,DELETE'), false)
  AND NOT COALESCE(has_table_privilege('authenticated','public.equipped_equipment','INSERT,UPDATE,DELETE'), false)),
 ('anon_equipment_read_denied',
  NOT COALESCE(has_table_privilege('anon','public.owned_equipment','SELECT'), false)
  AND NOT COALESCE(has_table_privilege('anon','public.equipped_equipment','SELECT'), false)),
 ('equipment_ownership_fk',
  EXISTS (SELECT 1 FROM pg_constraint WHERE contype='f'
    AND conrelid=to_regclass('public.equipped_equipment')
    AND confrelid=to_regclass('public.owned_equipment'))),
 ('xp_award_trigger_enabled',
  EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('public.xp_ledger')
    AND tgname='grant_ashen_hood_on_ledger_insert' AND NOT tgisinternal
    AND tgenabled='O')),
 ('xp_trigger_not_client_callable',
  NOT COALESCE(has_function_privilege('authenticated',
    to_regprocedure('public.grant_ashen_hood_from_xp()'),'EXECUTE'),false)
  AND NOT COALESCE(has_function_privilege('anon',
    to_regprocedure('public.grant_ashen_hood_from_xp()'),'EXECUTE'),false)),
 ('gear_read_rpc_invoker',
  COALESCE((SELECT NOT prosecdef FROM pg_proc WHERE oid=
    to_regprocedure('public.get_earned_gear()')),false)),
 ('gear_equip_rpc_definer',
  COALESCE((SELECT prosecdef FROM pg_proc WHERE oid=
    to_regprocedure('public.equip_earned_armor(text,boolean)')),false)),
 ('gear_rpcs_authenticated_only',
  COALESCE(has_function_privilege('authenticated',
    to_regprocedure('public.get_earned_gear()'),'EXECUTE'),false)
  AND COALESCE(has_function_privilege('authenticated',
    to_regprocedure('public.equip_earned_armor(text,boolean)'),'EXECUTE'),false)
  AND NOT COALESCE(has_function_privilege('anon',
    to_regprocedure('public.get_earned_gear()'),'EXECUTE'),false)
  AND NOT COALESCE(has_function_privilege('anon',
    to_regprocedure('public.equip_earned_armor(text,boolean)'),'EXECUTE'),false)),
 ('backfill_all_verified_10xp_owners',
  NOT EXISTS (
    SELECT 1 FROM (
      SELECT owner_id FROM public.xp_ledger GROUP BY owner_id HAVING count(*) >= 10
    ) eligible
    LEFT JOIN public.owned_equipment o
      ON o.owner_id=eligible.owner_id AND o.item_id='ashen-hood'
    WHERE o.owner_id IS NULL)),
 ('no_unearned_armor_ownership',
  NOT EXISTS (
    SELECT 1 FROM public.owned_equipment o
    LEFT JOIN (
      SELECT owner_id, count(*) AS xp FROM public.xp_ledger GROUP BY owner_id
    ) earned ON earned.owner_id=o.owner_id
    WHERE COALESCE(earned.xp,0) < 10))
)
SELECT bool_and(passed) AS postmigration_catalog_pass,
       jsonb_object_agg(name, passed ORDER BY name) AS checks,
       COALESCE(jsonb_agg(name ORDER BY name) FILTER (WHERE NOT passed),'[]'::jsonb) AS failed_checks,
       (SELECT count(*) FROM public.xp_ledger) AS xp_ledger_rows,
       (SELECT count(*) FROM public.owned_equipment) AS owned_equipment_rows,
       (SELECT count(*) FROM public.equipped_equipment) AS equipped_equipment_rows,
       'Catalog/backfill only: still require authenticated two-user RLS, QA runtime routing, recovery evidence and iPhone acceptance' AS limitation
FROM checks;
