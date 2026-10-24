#!/bin/sh
# Applies migrations 0001 through 0005, then 0007, to a throwaway local database.
# 0006 is not part of this script. Does not touch production or any hosted Supabase project.
set -eu
root=$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)
db=life_ascension_auth_test
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS ${db};"
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE ${db};"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$db" -f "$root/tests/sql/prelude.sql"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$db" -f "$root/supabase/migrations/202610230001_core.sql"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$db" -f "$root/supabase/migrations/202610230002_api_keys_progress.sql"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$db" -f "$root/supabase/migrations/202610230003_future_quest_scheduling.sql"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$db" -f "$root/supabase/migrations/202610230004_lifetime_xp.sql"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$db" -f "$root/supabase/migrations/202610240005_api_key_user_context.sql"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$db" -f "$root/supabase/migrations/202610240007_daily_late_window.sql"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$db" -f "$root/tests/sql/api_keys_progress_smoke.sql"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$db" -f "$root/tests/sql/scheduling_auth_smoke.sql"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$db" -f "$root/tests/sql/two_user_mcp_auth.sql"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$db" -f "$root/tests/sql/daily_late_window_smoke.sql"
echo "sql smoke tests passed"
