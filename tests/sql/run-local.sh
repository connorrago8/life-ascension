#!/bin/sh
# Applies the core and API-key migrations to a throwaway local database.
set -eu
root=$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)
db=life_ascension_auth_test
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS ${db};"
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE ${db};"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$db" -f "$root/tests/sql/prelude.sql"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$db" -f "$root/supabase/migrations/202610230001_core.sql"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$db" -f "$root/supabase/migrations/202610230002_api_keys_progress.sql"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$db" -f "$root/tests/sql/api_keys_progress_smoke.sql"
echo "sql smoke test passed"
