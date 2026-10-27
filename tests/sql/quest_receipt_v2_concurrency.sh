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
