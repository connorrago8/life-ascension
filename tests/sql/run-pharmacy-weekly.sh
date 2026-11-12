#!/usr/bin/env bash
# Disposable local PostgreSQL only. Never point this at hosted QA or Production.
# Usage: sudo -u postgres bash tests/sql/run-pharmacy-weekly.sh
set -euo pipefail
root=$(cd "$(dirname "$0")/../.." && pwd)
db="${DB:-life_ascension_pharmacy_weekly}"
psql -v ON_ERROR_STOP=1 -q -c "DROP DATABASE IF EXISTS ${db};" -c "CREATE DATABASE ${db};"
psql -v ON_ERROR_STOP=1 -q -d "$db" -f "$root/tests/sql/prelude.sql" >/dev/null
psql -v ON_ERROR_STOP=1 -q -d "$db" -c "create schema if not exists extensions; create extension if not exists pgcrypto with schema extensions;" >/dev/null
for file in "$root"/supabase/migrations/*.sql; do
  base=$(basename "$file")
  if [[ "$base" == "202611060001_quest_base_xp10.sql" ]]; then
    if err=$(psql -v ON_ERROR_STOP=1 -q -d "$db" -f "$file" 2>&1); then
      continue
    fi
    if grep -q 'Unexpected TEST XP mint' <<<"$err"; then
      echo "NOTE: 202611060001 guard refused the repo mint; game-day migration supplies personal base-10"
      continue
    fi
    printf '%s\n' "$err" >&2
    exit 1
  fi
  psql -v ON_ERROR_STOP=1 -q -d "$db" -f "$file" >/dev/null
done
psql -v ON_ERROR_STOP=1 -q -d "$db" -f "$root/tests/sql/pharmacy_weekly_smoke.sql" | grep -q 'pharmacy weekly smoke passed'
echo "PASS pharmacy_weekly_smoke.sql"
psql -v ON_ERROR_STOP=1 -q -d "$db" -f "$root/supabase/rollbacks/20261112013258_pharmacy_weekly_descriptions_down.sql" >/dev/null
psql -v ON_ERROR_STOP=1 -q -d "$db" -f "$root/supabase/rollbacks/20261112011949_pharmacy_weekly_autopilot_down.sql" >/dev/null
psql -v ON_ERROR_STOP=1 -q -d "$db" <<'SQL'
do $$ begin
  assert not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'quests' and column_name in ('fixed_reveal', 'weekly_weekday', 'description'));
  assert position('% 4740' in pg_catalog.pg_get_functiondef('public.quest_weekly_appears_at(uuid,uuid,date,text)'::regprocedure)) > 0;
  assert position('fixed_reveal' in pg_catalog.pg_get_functiondef('public.ensure_quest_instance(uuid,date)'::regprocedure)) = 0;
  assert position('companion_one_shot' in pg_catalog.pg_get_functiondef('public.ensure_quest_instance(uuid,date)'::regprocedure)) > 0;
  assert position('fixed_reveal is not true' in pg_catalog.pg_get_functiondef('public._place_companion_quest(uuid)'::regprocedure)) = 0;
  assert to_regprocedure('public.apply_pharmacy_weekly_pack()') is null;
end $$;
SQL
echo "PASS pharmacy weekly rollback"
psql -v ON_ERROR_STOP=1 -q -d "$db" -f "$root/supabase/migrations/20261112011949_pharmacy_weekly_autopilot.sql" >/dev/null
psql -v ON_ERROR_STOP=1 -q -d "$db" -f "$root/supabase/migrations/20261112013258_pharmacy_weekly_descriptions.sql" >/dev/null
psql -v ON_ERROR_STOP=1 -q -d "$db" -f "$root/supabase/migrations/20261112013258_pharmacy_weekly_descriptions.sql" >/dev/null
psql -v ON_ERROR_STOP=1 -q -d "$db" <<'SQL'
do $$ begin
  assert public.quest_weekly_appears_at('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000d0a1', '2026-10-26', 'America/Chicago')
    = '2026-10-29 07:47:00+00'::timestamptz;
end $$;
SQL
echo "PASS pharmacy weekly migration reapplied"
