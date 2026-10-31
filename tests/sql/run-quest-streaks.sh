#!/usr/bin/env bash
# Local runner for the quest & streak SQL checks (not in CI: the workflow lists migrations
# explicitly and is not edited from this branch). Disposable local PostgreSQL only.
# Usage: PGHOST=/tmp PGPORT=5544 PGUSER=postgres bash tests/sql/run-quest-streaks.sh
set -euo pipefail
root=$(cd "$(dirname "$0")/../.." && pwd)
db="${DB:-life_ascension_streak_test}"
psql -v ON_ERROR_STOP=1 -q -c "DROP DATABASE IF EXISTS ${db};" -c "CREATE DATABASE ${db};"
psql -v ON_ERROR_STOP=1 -q -d "$db" -f "$root/tests/sql/prelude.sql" >/dev/null
for file in "$root"/supabase/migrations/*.sql; do psql -v ON_ERROR_STOP=1 -q -d "$db" -f "$file" >/dev/null; done
psql -v ON_ERROR_STOP=1 -q -d "$db" -f "$root/tests/sql/quest_streaks_smoke.sql" | grep -q 'quest streak smoke passed'
echo "PASS quest_streaks_smoke.sql"
DB="$db" bash "$root/tests/sql/quest_streaks_concurrency.sh"
# The rollback must apply cleanly after real bonus and weekly data exist.
psql -v ON_ERROR_STOP=1 -q -d "$db" -f "$root/supabase/rollbacks/202610310001_quest_streaks_weekly_down.sql" >/dev/null
echo "PASS rollback applies"
