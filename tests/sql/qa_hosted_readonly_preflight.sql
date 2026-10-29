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
