-- READ ONLY. Execute ONLY against existing QA project njqwwimzrsunheehnnnt.
-- No secrets, patient records, or user rows. Save the single `preflight` JSON
-- object and run the local gate with the independently verified QA project ref.
-- This catalog gate is NOT a two-user RLS test, a backup, or migration approval.
WITH rpc AS (
  SELECT pg_get_functiondef('public.log_quest_progress(uuid,uuid,integer)'::regprocedure) AS definition
), tables AS (
  SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled,
         COALESCE((
           SELECT jsonb_agg(jsonb_build_object(
             'name', p.policyname, 'cmd', p.cmd, 'roles', p.roles, 'qual', p.qual
           ) ORDER BY p.policyname)
           FROM pg_policies p
           WHERE p.schemaname = 'public' AND p.tablename = c.relname
         ), '[]'::jsonb) AS policies
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname IN ('quests', 'quest_instances', 'quest_progress_operations')
)
SELECT jsonb_build_object(
  'function_sha256', encode(sha256(convert_to(rpc.definition, 'UTF8')), 'hex'),
  'atomic_clear_present', position('and p_delta <> -v_inst.current_amount' in rpc.definition) > 0,
  'authenticated_exec', has_function_privilege('authenticated', 'public.log_quest_progress(uuid,uuid,integer)', 'EXECUTE'),
  'anon_exec', has_function_privilege('anon', 'public.log_quest_progress(uuid,uuid,integer)', 'EXECUTE'),
  'tables', COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'table_name', table_name, 'rls_enabled', rls_enabled, 'policies', policies
  ) ORDER BY table_name) FROM tables), '[]'::jsonb)
) AS preflight
FROM rpc;
