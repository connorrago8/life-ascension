-- TEST-only history repair for project njqwwimzrsunheehnnnt.
-- Reviewed insert. It does not re-run SQL, rewrite functions, or touch player rows.
--
-- What was out of step:
--   * public.quest_streak_xp already uses the half-up base-10 formula from
--     supabase/migrations/202611060001_quest_base_xp10.sql, but schema_migrations
--     has no version 202611060001.
--   * Push tables from supabase/migrations/202611140003_engagement_pwa_push.sql
--     are already present. History recorded that apply as version 202611140001
--     named engagement_pwa_push, which is not the repo filename. The repo file
--     202611140001_replace_cook_dinner_pack.sql was applied later as 20261114160250.
--     This script does not delete or rename 202611140001. Deleting it would make
--     a later push look like cook-dinner had never been recorded under that version.
--
-- After this script, 202611060001 and 202611140003 are recorded as applied so a
-- later push does not execute those files again.

do $$
declare
  streak text := pg_catalog.pg_get_functiondef('public.quest_streak_xp(integer,integer,boolean)'::regprocedure);
begin
  if position('+ 5' in streak) = 0 or position('p_first then p_base' in streak) = 0 then
    raise exception 'refusing history repair: quest_streak_xp is not the applied half-up formula';
  end if;
  if to_regclass('public.push_subscriptions') is null
     or to_regclass('public.notification_preferences') is null
     or to_regclass('public.push_outbox') is null
     or to_regclass('public.widget_tokens') is null then
    raise exception 'refusing history repair: engagement push tables are not all present';
  end if;

  if not exists (select 1 from supabase_migrations.schema_migrations where version = '202611060001') then
    insert into supabase_migrations.schema_migrations (version, name, statements)
    values (
      '202611060001',
      'quest_base_xp10',
      array['-- repaired: already applied on TEST; this row does not re-run the migration']
    );
  end if;

  if not exists (select 1 from supabase_migrations.schema_migrations where version = '202611140003') then
    insert into supabase_migrations.schema_migrations (version, name, statements)
    values (
      '202611140003',
      'engagement_pwa_push',
      array['-- repaired: objects already present from the apply recorded as 202611140001; this row does not re-run the migration']
    );
  end if;
end $$;
