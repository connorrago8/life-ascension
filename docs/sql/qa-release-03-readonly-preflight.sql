-- LIFE ASCENSION 0.3: read-only QA migration compatibility preflight.
-- Run only after independently confirming project ref njqwwimzrsunheehnnnt.
-- This SELECT neither authorizes nor applies migrations. A recoverable QA backup,
-- reviewed migration ordering, security approval and Founder authorization remain mandatory.
-- The existing PR #32 candidate adds 202610270001_quest_receipt_v2.sql followed
-- by 202610280001_earned_armor.sql; DO NOT reapply QA's existing PR21 0008-0012.
WITH checks(name, passed) AS (
 VALUES
 ('existing_partial_progress_migrations',
  (SELECT count(*) = 5 FROM supabase_migrations.schema_migrations
   WHERE name IN ('pr21_partial_progress','pr21_progress_configuration',
                  'pr21_progress_completion_guard','pr21_atomic_tracked_creation',
                  'pr21_api_progress_wrapper'))),
 ('tracked_quest_columns',
  (SELECT count(*) = 3 FROM information_schema.columns
   WHERE table_schema='public' AND table_name='quests'
     AND column_name IN ('target_amount','progress_unit','progress_increment'))),
 ('tracked_instance_columns',
  (SELECT count(*) = 2 FROM information_schema.columns
   WHERE table_schema='public' AND table_name='quest_instances'
     AND column_name IN ('current_amount','progress_updated_at'))),
 ('progress_operations_rls',
  COALESCE((SELECT relrowsecurity FROM pg_class WHERE oid=to_regclass('public.quest_progress_operations')),false)),
 ('quests_rls',
  COALESCE((SELECT relrowsecurity FROM pg_class WHERE oid=to_regclass('public.quests')),false)),
 ('instances_rls',
  COALESCE((SELECT relrowsecurity FROM pg_class WHERE oid=to_regclass('public.quest_instances')),false)),
 ('xp_ledger_rls',
  COALESCE((SELECT relrowsecurity FROM pg_class WHERE oid=to_regclass('public.xp_ledger')),false)),
 ('authenticated_progress_rpc',
  COALESCE(has_function_privilege('authenticated',
    to_regprocedure('public.log_quest_progress(uuid,uuid,integer)'), 'EXECUTE'),false)),
 ('anonymous_progress_rpc_denied',
  NOT COALESCE(has_function_privilege('anon',
    to_regprocedure('public.log_quest_progress(uuid,uuid,integer)'), 'EXECUTE'),false)),
 ('xp_exactly_one_constraint',
  EXISTS (SELECT 1 FROM pg_constraint
    WHERE conrelid=to_regclass('public.xp_ledger') AND conname='xp_ledger_amount_check'
      AND pg_get_constraintdef(oid) ILIKE '%amount = 1%')),
 ('xp_one_award_per_instance',
  EXISTS (SELECT 1 FROM pg_constraint
    WHERE conrelid=to_regclass('public.xp_ledger') AND conname='xp_ledger_instance_id_key'
      AND contype='u')),
 ('v2_receipt_not_preinstalled',
  to_regprocedure('public.set_quest_instance_status_v2(uuid,text)') IS NULL),
 ('earned_gear_rpcs_not_preinstalled',
  to_regprocedure('public.get_earned_gear()') IS NULL
  AND to_regprocedure('public.equip_earned_armor(text,boolean)') IS NULL),
 ('armor_tables_not_preinstalled',
  to_regclass('public.owned_equipment') IS NULL
  AND to_regclass('public.equipped_equipment') IS NULL)
)
SELECT bool_and(passed) AS structural_compatibility_pass,
       jsonb_object_agg(name,passed ORDER BY name) AS checks,
       COALESCE(jsonb_agg(name ORDER BY name) FILTER (WHERE NOT passed),'[]'::jsonb) AS failed_checks,
       'No hosted migration/write permitted by this result; verify backup and approval separately' AS limitation
FROM checks;
