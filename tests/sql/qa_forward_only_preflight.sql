-- READ-ONLY QA migration preflight. NO DDL, DML, or hosted migration.
-- Execute with psql -v expected_progress_md5=<independently reviewed fingerprint>.
-- A PASS is schema compatibility evidence only, NOT backup/isolation/release approval.
-- This checks the *pre-v2* target and fails closed after v2 is installed.
WITH baseline AS (
 SELECT
  md5(pg_get_functiondef(to_regprocedure('public.log_quest_progress(uuid,uuid,integer)'))) AS progress_md5,
  to_regprocedure('public.set_quest_instance_status_v2(uuid,text)') IS NULL AS v2_absent,
  (SELECT count(*) = 9 FROM information_schema.columns
    WHERE table_schema='public' AND
     ((table_name='quests' AND column_name IN ('target_amount','progress_unit','progress_increment'))
      OR (table_name='quest_instances' AND column_name IN ('current_amount','progress_updated_at'))
      OR (table_name='quest_progress_operations' AND column_name IN ('owner_id','instance_id','request_id','delta')))) AS columns_present,
  (SELECT count(*) = 3 FROM pg_constraint
    WHERE connamespace='public'::regnamespace AND convalidated AND
      conname IN ('quests_progress_config_valid',
                  'quest_instances_nonnegative_progress',
                  'quest_progress_operations_owner_id_request_id_key')) AS constraints_validated,
  COALESCE((SELECT relrowsecurity FROM pg_class
    WHERE oid=to_regclass('public.quest_progress_operations')),false) AS journal_rls_enabled,
  EXISTS(SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='quest_progress_operations'
      AND policyname='quest_progress_operations_read' AND cmd='SELECT'
      AND 'authenticated'=ANY(roles)) AS journal_owner_policy_present,
  COALESCE((SELECT prosecdef FROM pg_proc
    WHERE oid=to_regprocedure('public.log_quest_progress(uuid,uuid,integer)')),false) AS progress_security_definer,
  COALESCE(has_function_privilege('authenticated',
    to_regprocedure('public.log_quest_progress(uuid,uuid,integer)'), 'EXECUTE'),false) AS authenticated_rpc_allowed,
  COALESCE(has_function_privilege('anon',
    to_regprocedure('public.log_quest_progress(uuid,uuid,integer)'), 'EXECUTE'),true) AS anon_rpc_allowed,
  COALESCE(has_table_privilege('authenticated',
    to_regclass('public.quest_progress_operations'), 'UPDATE'),true) AS direct_journal_update_allowed
)
SELECT CASE WHEN progress_md5 = :'expected_progress_md5'
 AND v2_absent AND columns_present AND constraints_validated
 AND journal_rls_enabled AND journal_owner_policy_present
 AND progress_security_definer AND authenticated_rpc_allowed
 AND NOT anon_rpc_allowed AND NOT direct_journal_update_allowed
 THEN 'PASS' ELSE 'STOP' END
FROM baseline;
