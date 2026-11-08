#!/usr/bin/env bash
# Local runner for the quest & streak SQL checks (not in CI: the workflow lists migrations
# explicitly and is not edited from this branch). Disposable local PostgreSQL only.
# Usage: PGHOST=/tmp PGPORT=5544 PGUSER=postgres bash tests/sql/run-quest-streaks.sh
set -euo pipefail
root=$(cd "$(dirname "$0")/../.." && pwd)
db="${DB:-life_ascension_streak_test}"
psql -v ON_ERROR_STOP=1 -q -c "DROP DATABASE IF EXISTS ${db};" -c "CREATE DATABASE ${db};"
psql -v ON_ERROR_STOP=1 -q -d "$db" -f "$root/tests/sql/prelude.sql" >/dev/null
for file in "$root"/supabase/migrations/*.sql; do
  base=$(basename "$file")
  if [[ "$base" == "202611060001_quest_base_xp10.sql" ]]; then
    # The guard compares _award_quest_xp to an Izzy body that exists only on hosted TEST,
    # not in this repo chain. Statements before the guard (half-up rounding, base_amount)
    # commit; 202611080001 then installs the personal base-10 minter. Any other error fails.
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
psql -v ON_ERROR_STOP=1 -q -d "$db" -f "$root/tests/sql/quest_streaks_smoke.sql" | grep -q 'quest streak smoke passed'
echo "PASS quest_streaks_smoke.sql"
psql -v ON_ERROR_STOP=1 -q -d "$db" -f "$root/tests/sql/quest_game_day_smoke.sql" | grep -q 'quest game day smoke passed'
echo "PASS quest_game_day_smoke.sql"
DB="$db" bash "$root/tests/sql/quest_streaks_concurrency.sh"
psql -v ON_ERROR_STOP=1 -q -d "$db" -f "$root/tests/sql/quest_xp10_smoke.sql" | grep -q 'quest xp10 smoke passed'
echo "PASS quest_xp10_smoke.sql"
# Game-day rollback restores midnight windows, reapply is idempotent, then the older
# streak rollback still applies. 202611060001 is not re-applied: its guard is not
# idempotent on this chain once _award_quest_xp has been replaced or dropped.
psql -v ON_ERROR_STOP=1 -q -d "$db" -f "$root/supabase/rollbacks/202611080001_quest_game_day_5am_down.sql" >/dev/null
psql -v ON_ERROR_STOP=1 -q -d "$db" <<'SQL'
do $$ begin
  assert to_regprocedure('public.quest_game_day(timestamptz,text)') is null;
  assert position('% 5040' in pg_catalog.pg_get_functiondef('public.quest_weekly_appears_at(uuid,uuid,date,text)'::regprocedure)) > 0;
  assert position('interval ''5 hours''' in pg_catalog.pg_get_functiondef('public.quest_has_completion_on(uuid,date,text)'::regprocedure)) = 0;
end $$;
SQL
echo "PASS game-day rollback restores midnight"
psql -v ON_ERROR_STOP=1 -q -d "$db" -f "$root/supabase/migrations/202611080001_quest_game_day_5am.sql" >/dev/null
psql -v ON_ERROR_STOP=1 -q -d "$db" <<'SQL'
do $$ begin
  assert public.quest_game_day('2026-06-15 09:59:00+00', 'America/Chicago') = '2026-06-14';
  assert position('% 4740' in pg_catalog.pg_get_functiondef('public.quest_weekly_appears_at(uuid,uuid,date,text)'::regprocedure)) > 0;
end $$;
SQL
echo "PASS game-day migration reapplied"
psql -v ON_ERROR_STOP=1 -q -d "$db" -f "$root/supabase/rollbacks/202611080001_quest_game_day_5am_down.sql" >/dev/null
psql -v ON_ERROR_STOP=1 -q -d "$db" -f "$root/supabase/rollbacks/202610310001_quest_streaks_weekly_down.sql" >/dev/null
echo "PASS streak rollback applies"
