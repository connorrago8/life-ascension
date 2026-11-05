#!/usr/bin/env bash
# Independent sessions compete for the same quest completion in isolated CI Postgres.
set -euo pipefail
db=life_ascension_auth_test
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
user_id="00000000-0000-0000-0000-0000000000c1"
psql -v ON_ERROR_STOP=1 -q -d "$db" -c "INSERT INTO auth.users(id) VALUES ('$user_id');"
quest_id="$(psql -v ON_ERROR_STOP=1 -qAt -d "$db" <<SQL
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','$user_id',false);
SELECT public.create_scheduled_quest('Concurrent receipt','personal_growth','once',
  (now() AT TIME ZONE 'America/Chicago')::date,'scheduled');
SQL
)"
quest_id="$(printf '%s\n' "$quest_id" | grep -E '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$' | tail -1)"
test -n "$quest_id"
# Resolve the fixture as test administrator because direct authenticated
# SELECT on quest_instances is intentionally restricted in this schema.
instance_id="$(psql -v ON_ERROR_STOP=1 -qAt -d "$db" -c "SELECT id FROM public.quest_instances WHERE quest_id='$quest_id';")"
test -n "$instance_id"
psql -v ON_ERROR_STOP=1 -qAt -d "$db" >"$tmp/a.log" 2>"$tmp/a.err" <<SQL &
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','$user_id',true);
SELECT (r->>'reward_status') || ':' || (r->>'xp_awarded')
FROM (SELECT public.set_quest_instance_status_v2('$instance_id'::uuid,'complete') r) receipt;
\! touch "$tmp/locked"
SELECT pg_sleep(2);
COMMIT;
SQL
pid_a=$!
for i in $(seq 1 50); do
  if test -f "$tmp/locked"; then break; fi
  if ! kill -0 "$pid_a" 2>/dev/null; then cat "$tmp/a.err"; exit 1; fi
  sleep 0.1
done
test -f "$tmp/locked"
psql -v ON_ERROR_STOP=1 -qAt -d "$db" >"$tmp/b.log" 2>"$tmp/b.err" <<SQL &
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','$user_id',true);
SELECT (r->>'reward_status') || ':' || (r->>'xp_awarded')
FROM (SELECT public.set_quest_instance_status_v2('$instance_id'::uuid,'complete') r) receipt;
COMMIT;
SQL
pid_b=$!
wait "$pid_a" || { cat "$tmp/a.err"; exit 1; }
wait "$pid_b" || { cat "$tmp/b.err"; exit 1; }
grep -qx 'awarded:1' "$tmp/a.log" || { cat "$tmp/a.log"; exit 1; }
grep -qx 'already_awarded:0' "$tmp/b.log" || { cat "$tmp/b.log"; exit 1; }
result="$(psql -v ON_ERROR_STOP=1 -qAt -d "$db" -c "SELECT count(*) || ':' || coalesce(sum(amount),0) FROM public.xp_ledger WHERE instance_id='$instance_id';")"
test "$result" = "1:1" || { echo "Unexpected ledger count/sum: $result"; exit 1; }
echo "PASS concurrent requests: awarded:1 then already_awarded:0, one ledger row"

# An aborted winner must not consume the one durable XP award. Unlike a
# sequential retry, this test proves B is blocked by A's still-open row lock.
# This script is intended ONLY for the disposable CI PostgreSQL database.
rollback_quest_id="$(psql -v ON_ERROR_STOP=1 -qAt -d "$db" <<SQL
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','$user_id',false);
SELECT public.create_scheduled_quest('Rollback race receipt','personal_growth','once',
  (now() AT TIME ZONE 'America/Chicago')::date,'scheduled');
SQL
)"
rollback_quest_id="$(printf '%s\n' "$rollback_quest_id" | grep -E '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$' | tail -1)"
test -n "$rollback_quest_id"
rollback_instance_id="$(psql -v ON_ERROR_STOP=1 -qAt -d "$db" -c "SELECT id FROM public.quest_instances WHERE quest_id='$rollback_quest_id';")"
test -n "$rollback_instance_id"

# Release the held transaction even if a lock-wait assertion fails.
rollback_a_pid=""
rollback_b_pid=""
rollback_cleanup() {
  touch "$tmp/rollback_release" 2>/dev/null || true
  if test -n "$rollback_a_pid"; then wait "$rollback_a_pid" 2>/dev/null || true; fi
  if test -n "$rollback_b_pid"; then wait "$rollback_b_pid" 2>/dev/null || true; fi
  rm -rf "$tmp"
}
trap rollback_cleanup EXIT

PGAPPNAME="la_rollback_a_$$" psql -v ON_ERROR_STOP=1 -qAt -d "$db" >"$tmp/rollback_a.log" 2>"$tmp/rollback_a.err" <<SQL &
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','$user_id',true);
SELECT (r->>'reward_status') || ':' || (r->>'xp_awarded')
FROM (SELECT public.set_quest_instance_status_v2('$rollback_instance_id'::uuid,'complete') r) receipt;
\! touch "$tmp/rollback_locked"
\! while ! test -f "$tmp/rollback_release"; do sleep 0.1; done
ROLLBACK;
SQL
rollback_a_pid=$!
for i in $(seq 1 80); do
  if test -f "$tmp/rollback_locked"; then break; fi
  if ! kill -0 "$rollback_a_pid" 2>/dev/null; then
    cat "$tmp/rollback_a.err"; exit 1
  fi
  sleep 0.1
done
test -f "$tmp/rollback_locked" || { echo 'Rollback session A never acquired lock'; exit 1; }

rollback_b_app="la_rollback_b_$$"
PGAPPNAME="$rollback_b_app" psql -v ON_ERROR_STOP=1 -qAt -d "$db" >"$tmp/rollback_b.log" 2>"$tmp/rollback_b.err" <<SQL &
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','$user_id',true);
SELECT (r->>'reward_status') || ':' || (r->>'xp_awarded')
FROM (SELECT public.set_quest_instance_status_v2('$rollback_instance_id'::uuid,'complete') r) receipt;
COMMIT;
SQL
rollback_b_pid=$!
observed_block=0
for i in $(seq 1 80); do
  blocked="$(psql -v ON_ERROR_STOP=1 -qAt -d "$db" -c "SELECT EXISTS (SELECT 1 FROM pg_catalog.pg_stat_activity WHERE datname = current_database() AND application_name = '$rollback_b_app' AND wait_event_type = 'Lock' AND pg_catalog.cardinality(pg_catalog.pg_blocking_pids(pid)) > 0);")"
  if test "$blocked" = t; then observed_block=1; break; fi
  if ! kill -0 "$rollback_b_pid" 2>/dev/null; then break; fi
  sleep 0.1
done
# Session A's provisional receipt must be rolled back, not committed.
touch "$tmp/rollback_release"
wait "$rollback_a_pid" || { cat "$tmp/rollback_a.err"; exit 1; }
rollback_a_pid=""
wait "$rollback_b_pid" || { cat "$tmp/rollback_b.err"; exit 1; }
rollback_b_pid=""
test "$observed_block" = 1 || { echo 'No concurrent lock wait observed; rollback race not established'; exit 1; }
grep -qx 'awarded:1' "$tmp/rollback_a.log" || { cat "$tmp/rollback_a.log"; exit 1; }
grep -qx 'awarded:1' "$tmp/rollback_b.log" || { cat "$tmp/rollback_b.log"; exit 1; }
rollback_result="$(psql -v ON_ERROR_STOP=1 -qAt -d "$db" -c "SELECT (SELECT count(*)::text || ':' || coalesce(sum(amount),0)::text FROM public.xp_ledger WHERE instance_id='$rollback_instance_id') || ':' || (SELECT count(*) FROM public.quest_events WHERE instance_id='$rollback_instance_id' AND event_type='completed') || ':' || (SELECT status FROM public.quest_instances WHERE id='$rollback_instance_id');")"
test "$rollback_result" = '1:1:1:completed' || { echo "Rollback race durable state mismatch: $rollback_result"; exit 1; }
echo 'PASS rollback race: B blocked on A, A rolled back, B awarded exactly one durable XP'
