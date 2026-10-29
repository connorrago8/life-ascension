-- Read-only QA migration preflight. Safe to execute on the verified QA project.
-- Does not create a backup, prove recovery, authorize a migration, or modify data.
-- Run only after independently confirming project ref njqwwimzrsunheehnnnt.
WITH objects AS (
  SELECT 'public.quests' AS object_name, to_regclass('public.quests') IS NOT NULL AS present
  UNION ALL SELECT 'public.quest_instances', to_regclass('public.quest_instances') IS NOT NULL
  UNION ALL SELECT 'public.xp_ledger', to_regclass('public.xp_ledger') IS NOT NULL
  UNION ALL SELECT 'public.owned_equipment', to_regclass('public.owned_equipment') IS NOT NULL
  UNION ALL SELECT 'public.equipped_equipment', to_regclass('public.equipped_equipment') IS NOT NULL
), required_columns AS (
  SELECT 'quests.target_amount' AS object_name, EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='quests' AND column_name='target_amount') AS present
  UNION ALL SELECT 'quest_instances.current_amount', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='quest_instances' AND column_name='current_amount')
  UNION ALL SELECT 'quest_instances.completed_at', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='quest_instances' AND column_name='completed_at')
  UNION ALL SELECT 'xp_ledger.awarded_at', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='xp_ledger' AND column_name='awarded_at')
)
SELECT 'table' AS kind, object_name, present FROM objects
UNION ALL SELECT 'required_column', object_name, present FROM required_columns
ORDER BY kind, object_name;

-- Aggregate-only baseline: never export identities or quest contents into CI logs.
SELECT 'auth_users' AS metric, count(*) AS rows FROM auth.users
UNION ALL SELECT 'quests', count(*) FROM public.quests
UNION ALL SELECT 'instances', count(*) FROM public.quest_instances
UNION ALL SELECT 'xp_ledger', count(*) FROM public.xp_ledger
UNION ALL SELECT 'progress_operations', count(*) FROM public.quest_progress_operations
ORDER BY metric;

-- Structural exactly-once evidence (does not substitute for concurrent behavioral tests).
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid='public.xp_ledger'::regclass
  AND conname IN ('xp_ledger_instance_id_key','xp_ledger_amount_check','xp_ledger_instance_id_owner_id_fkey')
ORDER BY conname;


-- RPC surface compatibility for Beta's tracked progress and the pending 0.3
-- receipt/armor migrations. A NULL privilege means the RPC is not installed.
-- This SELECT is evidence only: a present function does not prove safe behavior.
WITH expected(signature, intended_role, phase) AS (VALUES
 ('public.log_quest_progress(uuid,uuid,integer)', 'authenticated', 'baseline'),
 ('public.configure_quest_progress(uuid,integer,text,integer)', 'authenticated', 'baseline'),
 ('public.create_tracked_quest(text,text,text,date,text,integer,text,integer)', 'authenticated', 'baseline'),
 ('public.set_quest_instance_status(uuid,text)', 'authenticated', 'baseline'),
 ('public.log_quest_progress_as_user(uuid,uuid,uuid,integer)', 'service_role', 'baseline'),
 ('public.set_quest_instance_status_v2(uuid,text)', 'authenticated', 'pending_review'),
 ('public.get_earned_gear()', 'authenticated', 'pending_review'),
 ('public.equip_earned_armor(text,boolean)', 'authenticated', 'pending_review')
)
SELECT signature, phase, intended_role,
       to_regprocedure(signature) IS NOT NULL AS installed,
       CASE WHEN to_regprocedure(signature) IS NULL THEN NULL
            ELSE has_function_privilege(intended_role,to_regprocedure(signature),'EXECUTE')
       END AS intended_role_execute,
       CASE WHEN to_regprocedure(signature) IS NULL THEN NULL
            ELSE has_function_privilege('anon',to_regprocedure(signature),'EXECUTE')
       END AS anon_execute,
       CASE WHEN to_regprocedure(signature) IS NULL THEN NULL
            ELSE has_function_privilege('authenticated',to_regprocedure(signature),'EXECUTE')
       END AS authenticated_execute
FROM expected ORDER BY signature;

-- A player may read only owner-scoped progress/equipment via RLS, never write
-- those tables directly. Pending armor tables are expected to be absent until
-- separately authorized QA migrations; NULL means not installed, not PASS.
WITH expected(table_name, phase) AS (VALUES
 ('public.quest_progress_operations', 'baseline'),
 ('public.owned_equipment', 'pending_review'),
 ('public.equipped_equipment', 'pending_review')
)
SELECT table_name, phase, to_regclass(table_name) IS NOT NULL AS installed,
       CASE WHEN to_regclass(table_name) IS NULL THEN NULL
            ELSE (SELECT c.relrowsecurity FROM pg_catalog.pg_class c
                  WHERE c.oid=to_regclass(table_name)) END AS rls_enabled,
       CASE WHEN to_regclass(table_name) IS NULL THEN NULL
            ELSE has_table_privilege('authenticated',to_regclass(table_name),'SELECT')
       END AS authenticated_select,
       CASE WHEN to_regclass(table_name) IS NULL THEN NULL
            ELSE has_table_privilege('authenticated',to_regclass(table_name),'INSERT,UPDATE,DELETE')
       END AS authenticated_any_dml,
       CASE WHEN to_regclass(table_name) IS NULL THEN NULL
            ELSE has_table_privilege('anon',to_regclass(table_name),'SELECT')
       END AS anon_select
FROM expected ORDER BY table_name;
