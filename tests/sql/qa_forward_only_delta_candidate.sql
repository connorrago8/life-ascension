-- OPERATOR-ONLY CANDIDATE. NEVER auto-apply or run against Production.
-- This file is intentionally outside supabase/migrations.
-- No hosted execution without Founder approval, QA-specific verified backup/restore,
-- deployment-bound QA-only client/server/privileged routing, and migration-ledger review.
-- Run with psql --single-transaction -v ON_ERROR_STOP=1 -f THIS_FILE
--   -f supabase/migrations/202610270001_quest_receipt_v2.sql
-- after setting PGOPTIONS="-c qa.expected_progress_md5=<independently reviewed QA md5>".
-- It changes ONLY the preexisting progress function body, never tables/history/rows.
-- A matching fingerprint is necessary, NOT sufficient, for release authorization.
DO $qa_delta$
DECLARE
  expected_md5 text := current_setting('qa.expected_progress_md5',true);
  current_def text;
  legacy_clause text := $legacy$  if p_delta < 0 and p_delta <> -v_quest.progress_increment then
    raise exception 'Undo must reverse one default increment';
  end if;$legacy$;
  replacement_clause text := $replacement$  if p_delta < 0
     and p_delta <> -v_quest.progress_increment
     and p_delta <> -v_inst.current_amount then
    raise exception 'Undo must reverse one increment or clear current progress';
  end if;$replacement$;
BEGIN
  IF expected_md5 IS NULL OR expected_md5 !~ '^[a-f0-9]{32}$' THEN
    RAISE EXCEPTION 'STOP: independently reviewed progress fingerprint required';
  END IF;
  IF to_regprocedure('public.log_quest_progress(uuid,uuid,integer)') IS NULL
     OR to_regprocedure('public.set_quest_instance_status_v2(uuid,text)') IS NOT NULL THEN
    RAISE EXCEPTION 'STOP: expected pre-v2 progress RPC state not found';
  END IF;
  IF (SELECT count(*) FROM information_schema.columns
      WHERE table_schema='public' AND
        ((table_name='quests' AND column_name IN ('target_amount','progress_unit','progress_increment'))
        OR (table_name='quest_instances' AND column_name IN ('current_amount','progress_updated_at'))
        OR (table_name='quest_progress_operations' AND column_name IN ('owner_id','instance_id','request_id','delta')))) <> 9
     OR (SELECT count(*) FROM pg_constraint
       WHERE connamespace='public'::regnamespace AND convalidated AND
       conname IN ('quests_progress_config_valid',
                   'quest_instances_nonnegative_progress',
                   'quest_progress_operations_owner_id_request_id_key')) <> 3
     OR NOT COALESCE((SELECT relrowsecurity FROM pg_class
       WHERE oid=to_regclass('public.quest_progress_operations')),false)
     OR NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public'
       AND tablename='quest_progress_operations' AND policyname='quest_progress_operations_read'
       AND cmd='SELECT' AND 'authenticated'=ANY(roles))
     OR NOT COALESCE((SELECT prosecdef FROM pg_proc
       WHERE oid=to_regprocedure('public.log_quest_progress(uuid,uuid,integer)')),false)
     OR NOT COALESCE(has_function_privilege('authenticated',
       to_regprocedure('public.log_quest_progress(uuid,uuid,integer)'),'EXECUTE'),false)
     OR COALESCE(has_function_privilege('anon',
       to_regprocedure('public.log_quest_progress(uuid,uuid,integer)'),'EXECUTE'),true)
     OR COALESCE(has_table_privilege('authenticated',
       to_regclass('public.quest_progress_operations'),'UPDATE'),true) THEN
    RAISE EXCEPTION 'STOP: preexisting QA schema, RLS, or grants differ';
  END IF;
  current_def := pg_get_functiondef('public.log_quest_progress(uuid,uuid,integer)'::regprocedure);
  IF md5(current_def) <> expected_md5 THEN
    RAISE EXCEPTION 'STOP: progress function fingerprint drift';
  END IF;
  IF position(legacy_clause IN current_def)=0
     OR position(replacement_clause IN current_def)>0 THEN
    RAISE EXCEPTION 'STOP: exact legacy undo clause not found once';
  END IF;
  IF length(current_def)-length(replace(current_def,legacy_clause,'')) <> length(legacy_clause) THEN
    RAISE EXCEPTION 'STOP: ambiguous legacy undo clause';
  END IF;
  EXECUTE replace(current_def,legacy_clause,replacement_clause);
  IF position(replacement_clause IN
      pg_get_functiondef('public.log_quest_progress(uuid,uuid,integer)'::regprocedure))=0 THEN
    RAISE EXCEPTION 'STOP: progress replacement not installed';
  END IF;
  RAISE NOTICE 'PASS isolated forward-only progress function replacement; v2 still separate';
END
$qa_delta$;
