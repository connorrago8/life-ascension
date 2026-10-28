#!/usr/bin/env bash
# Requires a Linux Docker runner. Creates only a disposable, networkless container.
set -euo pipefail
root=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
cd "$root"
printf '%s  %s\n' e1d8296ae724f5fd3b082b466ba8500224a6da503b3e2fbcc61c6b962b620e73 candidate-528d77d.tar.gz | sha256sum --check
command -v docker >/dev/null
scratch=$(mktemp -d)
container="life-m1-concurrency-$$"
cleanup(){ docker rm -f "$container" >/dev/null 2>&1 || true; rm -rf "$scratch"; }
trap cleanup EXIT
mkdir "$scratch/candidate"
tar -xzf candidate-528d77d.tar.gz -C "$scratch/candidate"
# No ports, host volumes, real accounts, production credentials, or network.
docker run --detach --rm --network none --name "$container" \
 --label life-ascension.verification=528d77d \
 -e POSTGRES_HOST_AUTH_METHOD=trust postgres:16 >/dev/null
ready=0
for n in $(seq 1 60); do
 if docker exec "$container" sh -c 'test "$(cat /proc/1/comm)" = postgres && pg_isready -U postgres'  >/dev/null 2>&1; then ready=1;break;fi
 sleep 1
done
test "$ready" = 1 || { docker logs "$container";exit 1; }
docker exec "$container" mkdir -p /candidate /qa
docker cp "$scratch/candidate/." "$container:/candidate"
docker cp "$root/prove-overlap.sh" "$container:/qa/prove-overlap.sh"
printf 'Candidate: 528d77d909e0df01287f839c5a408c682f33e146\n'
docker exec "$container" postgres --version
# Record the complete combined-candidate run. No remote database URL is accepted.
docker exec -e PGUSER=postgres -e PGDATABASE=life_ascension_auth_test "$container" bash -ceu '
 cd /candidate
 createdb --maintenance-db=postgres life_ascension_auth_test
 psql -X -v ON_ERROR_STOP=1 -f tests/sql/prelude.sql
 for file in supabase/migrations/*.sql; do psql -X -v ON_ERROR_STOP=1 -f "$file"; done
 for file in api_keys_progress_smoke.sql scheduling_auth_smoke.sql two_user_mcp_auth.sql archive_compat_smoke.sql daily_late_window_smoke.sql quest_classification_smoke.sql quest_board_m1_smoke.sql; do
  psql -X -v ON_ERROR_STOP=1 -f "tests/sql/$file"
 done
 bash tests/sql/quest_receipt_v2_concurrency.sh
 bash /qa/prove-overlap.sh
' 2>&1 | tee concurrency.log
printf 'PASS isolated runner completed. Container removed by EXIT trap.\n'
