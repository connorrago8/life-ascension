#!/usr/bin/env bash
# Supplemental validation only; candidate 528d77d is not modified.
set -euo pipefail
: "${PGDATABASE:=life_ascension_auth_test}"
export PGDATABASE
scratch=$(mktemp -d)
cleanup(){ touch "$scratch/release"; for pid in ${pid_a:-} ${pid_b:-}; do kill "$pid" 2>/dev/null || true; done; rm -rf "$scratch"; }
trap cleanup EXIT
user_id=00000000-0000-4000-8000-000000009991
psql -X -v ON_ERROR_STOP=1 -q -c "INSERT INTO auth.users(id) VALUES ('$user_id');"
quest_id=$(psql -X -qAt -v ON_ERROR_STOP=1 <<SQL
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','$user_id',false);
SELECT public.create_scheduled_quest('Independent overlap proof','home','once',(now() AT TIME ZONE 'America/Chicago')::date,'scheduled');
SQL
)
quest_id=$(printf '%s\n' "$quest_id" | grep -E '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' | tail -1)
instance_id=$(psql -X -qAt -v ON_ERROR_STOP=1 -c "SELECT id FROM public.quest_instances WHERE quest_id='$quest_id';")
test -n "$instance_id"
psql -X -qAt -v ON_ERROR_STOP=1 >"$scratch/a.log" 2>"$scratch/a.err" <<SQL &
BEGIN;
SET LOCAL ROLE authenticated;
SELECT 'backend:' || pg_backend_pid();
SELECT set_config('request.jwt.claim.sub','$user_id',true);
SELECT (r->>'reward_status') || ':' || (r->>'xp_awarded') FROM (SELECT public.set_quest_instance_status_v2('$instance_id','complete') r) receipt;
\! touch "$scratch/locked"
\! for n in \$(seq 1 200); do test -f "$scratch/release" && break; sleep 0.1; done
COMMIT;
SQL
pid_a=$!
for n in $(seq 1 100); do test -f "$scratch/locked" && break; kill -0 "$pid_a" 2>/dev/null || { cat "$scratch/a.err"; exit 1; }; sleep 0.1; done
test -f "$scratch/locked"
backend_a=$(sed -n 's/^backend://p' "$scratch/a.log")
PGAPPNAME=m1_overlap_competitor psql -X -qAt -v ON_ERROR_STOP=1 >"$scratch/b.log" 2>"$scratch/b.err" <<SQL &
BEGIN;
SET LOCAL ROLE authenticated;
SELECT 'backend:' || pg_backend_pid();
SELECT set_config('request.jwt.claim.sub','$user_id',true);
SELECT (r->>'reward_status') || ':' || (r->>'xp_awarded') FROM (SELECT public.set_quest_instance_status_v2('$instance_id','complete') r) receipt;
COMMIT;
SQL
pid_b=$!
witness=0
for n in $(seq 1 100); do
 witness=$(psql -X -qAt -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM pg_stat_activity WHERE application_name='m1_overlap_competitor' AND state='active' AND wait_event_type='Lock' AND $backend_a=ANY(pg_blocking_pids(pid));")
 test "$witness" = 1 && break
 sleep 0.1
done
test "$witness" = 1 || { echo 'FAIL: no actual lock contention witnessed'; exit 1; }
mkdir -p artifacts/concurrency
psql -X -qAt -v ON_ERROR_STOP=1 -c "SELECT pid,application_name,wait_event_type,wait_event,pg_blocking_pids(pid) FROM pg_stat_activity WHERE application_name='m1_overlap_competitor';" > artifacts/concurrency/lock-witness.log
touch "$scratch/release"
wait "$pid_a" || { cat "$scratch/a.err"; exit 1; }
wait "$pid_b" || { cat "$scratch/b.err"; exit 1; }
cp "$scratch/a.log" artifacts/concurrency/session-a.log
cp "$scratch/b.log" artifacts/concurrency/session-b.log
backend_b=$(sed -n 's/^backend://p' "$scratch/b.log")
test -n "$backend_a" && test -n "$backend_b" && test "$backend_a" != "$backend_b"
receipts=$(cat "$scratch/a.log" "$scratch/b.log" | grep -E '^(awarded:1|already_awarded:0)$' | sort)
test "$receipts" = $'already_awarded:0\nawarded:1'
ledger=$(psql -X -qAt -v ON_ERROR_STOP=1 -c "SELECT count(*) || ':' || coalesce(sum(amount),0) FROM public.xp_ledger WHERE instance_id='$instance_id';")
test "$ledger" = '1:1'
printf 'PASS distinct backends: %s and %s\nPASS actual lock contention witnessed\n%s\nPASS ledger rows:XP = %s\n' "$backend_a" "$backend_b" "$receipts" "$ledger"
