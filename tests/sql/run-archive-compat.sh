#!/bin/sh
# Read-only check of origin/feature/quest-edit-archive. Does not merge or push that branch.
# Applies PR #1 migrations 0001-0005, then 0006 from the other branch, on throwaway databases.
set -eu
root=$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)
tip=$(git -C "$root" rev-parse origin/feature/quest-edit-archive)
echo "quest-edit-archive tip: $tip"
sql=$(git -C "$root" show origin/feature/quest-edit-archive:supabase/migrations/202610240006_quest_edit_archive.sql)

apply() {
  db=$1
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS ${db};"
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE ${db};"
  sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$db" -f "$root/tests/sql/prelude.sql"
  sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$db" -f "$root/supabase/migrations/202610230001_core.sql"
  sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$db" -f "$root/supabase/migrations/202610230002_api_keys_progress.sql"
  sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$db" -f "$root/supabase/migrations/202610230003_future_quest_scheduling.sql"
  sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$db" -f "$root/supabase/migrations/202610230004_lifetime_xp.sql"
  sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$db" -f "$root/supabase/migrations/202610240005_api_key_user_context.sql"
  printf '%s\n' "$sql" | sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$db"
}

apply life_ascension_archive_suite
set +e
sudo -u postgres psql -v ON_ERROR_STOP=1 -d life_ascension_archive_suite -f "$root/tests/sql/api_keys_progress_smoke.sql"
keys=$?
sudo -u postgres psql -v ON_ERROR_STOP=1 -d life_ascension_archive_suite -f "$root/tests/sql/scheduling_auth_smoke.sql"
sched=$?
sudo -u postgres psql -v ON_ERROR_STOP=1 -d life_ascension_archive_suite -f "$root/tests/sql/two_user_mcp_auth.sql"
two=$?
set -e
echo "existing suite on 0006: api_keys=$keys scheduling=$sched two_user=$two"

apply life_ascension_archive_compat
sudo -u postgres psql -v ON_ERROR_STOP=1 -d life_ascension_archive_compat -f "$root/tests/sql/archive_compat_smoke.sql"
echo "archive compat smoke passed"
