#!/bin/sh
# Throwaway check: 0001-0005, then 0006 from origin/feature/quest-edit-archive, then 0007.
# Reads that branch. Does not merge it, push it, or touch production.
set -eu
root=$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)
tip=$(git -C "$root" rev-parse origin/feature/quest-edit-archive)
echo "quest-edit-archive tip: $tip"
sql=$(git -C "$root" show origin/feature/quest-edit-archive:supabase/migrations/202610240006_quest_edit_archive.sql)
db=life_ascension_late_window_0006
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS ${db};"
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE ${db};"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$db" -f "$root/tests/sql/prelude.sql"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$db" -f "$root/supabase/migrations/202610230001_core.sql"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$db" -f "$root/supabase/migrations/202610230002_api_keys_progress.sql"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$db" -f "$root/supabase/migrations/202610230003_future_quest_scheduling.sql"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$db" -f "$root/supabase/migrations/202610230004_lifetime_xp.sql"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$db" -f "$root/supabase/migrations/202610240005_api_key_user_context.sql"
printf '%s\n' "$sql" | sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$db"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$db" -f "$root/supabase/migrations/202610240007_daily_late_window.sql"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$db" -f "$root/tests/sql/api_keys_progress_smoke.sql"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$db" -f "$root/tests/sql/scheduling_auth_smoke.sql"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$db" -f "$root/tests/sql/two_user_mcp_auth.sql"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$db" -f "$root/tests/sql/daily_late_window_smoke.sql"
echo "0001-0006-0007 sql smoke tests passed"
