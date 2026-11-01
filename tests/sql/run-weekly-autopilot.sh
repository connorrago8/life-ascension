#!/usr/bin/env bash
# Disposable local PostgreSQL only. Never point this at hosted QA or Production.
# Usage: PGHOST=/tmp PGPORT=5544 PGUSER=postgres bash tests/sql/run-weekly-autopilot.sh
set -euo pipefail
root=$(cd "$(dirname "$0")/../.." && pwd)
db="${DB:-life_ascension_weekly_autopilot}"
psql -v ON_ERROR_STOP=1 -q -c "DROP DATABASE IF EXISTS ${db};" -c "CREATE DATABASE ${db};"
psql -v ON_ERROR_STOP=1 -q -d "$db" -f "$root/tests/sql/prelude.sql" >/dev/null
for file in "$root"/supabase/migrations/*.sql; do
  psql -v ON_ERROR_STOP=1 -q -d "$db" -f "$file" >/dev/null
done
psql -v ON_ERROR_STOP=1 -q -d "$db" -f "$root/tests/sql/weekly_autopilot_smoke.sql" | grep -q 'weekly autopilot smoke passed'
echo "PASS weekly_autopilot_smoke.sql"
