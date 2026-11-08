#!/usr/bin/env bash
# Two sessions complete one Izzy quest, and two sessions log one activity.
# Exactly one XP award each. Disposable database only.
set -euo pipefail
db="${DB:-life_ascension_auth_test}"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
connor="00000000-0000-0000-0000-00000000c201"
izzy="00000000-0000-0000-0000-00000000c202"
psql -v ON_ERROR_STOP=1 -q -d "$db" <<SQL
INSERT INTO auth.users(id) VALUES ('$connor'), ('$izzy');
SQL
code=$(psql -v ON_ERROR_STOP=1 -qAt -d "$db" <<SQL
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','$connor',false);
SELECT public.companion_invite()->>'code';
SQL
)
code=$(printf '%s\n' "$code" | grep -E '^[0-9a-f]{12}$' | tail -1)
test -n "$code"
psql -v ON_ERROR_STOP=1 -q -d "$db" <<SQL
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','$izzy',false);
SELECT public.companion_accept('$code');
SELECT public.companion_send_quest('Race the lantern','',null,'');
SQL
quest=$(psql -v ON_ERROR_STOP=1 -qAt -d "$db" <<SQL
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','$connor',false);
SELECT (public.companion_respond_quest(id, true)->>'instanceId')
FROM public.companion_quests
WHERE to_user = '$connor' AND title = 'Race the lantern';
SQL
)
quest=$(printf '%s\n' "$quest" | grep -E '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$' | tail -1)
test -n "$quest"
psql -v ON_ERROR_STOP=1 -qAt -d "$db" >"$tmp/a.log" 2>"$tmp/a.err" <<SQL &
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','$connor',true);
SELECT (r->>'xp_awarded') FROM (
  SELECT public.companion_complete_quest(id) r
  FROM public.companion_quests WHERE instance_id = '$quest'
) x;
\! touch "$tmp/locked"
SELECT pg_sleep(1);
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
SELECT set_config('request.jwt.claim.sub','$connor',true);
SELECT (r->>'xp_awarded') FROM (
  SELECT public.companion_complete_quest(id) r
  FROM public.companion_quests WHERE instance_id = '$quest'
) x;
COMMIT;
SQL
pid_b=$!
wait "$pid_a" || { cat "$tmp/a.err"; exit 1; }
wait "$pid_b" || { cat "$tmp/b.err"; exit 1; }
sort "$tmp/a.log" "$tmp/b.log" | grep -qx '10'
sort "$tmp/a.log" "$tmp/b.log" | grep -qx '0'
rows=$(psql -v ON_ERROR_STOP=1 -qAt -d "$db" -c "SELECT count(*) || ':' || coalesce(sum(amount),0) FROM public.xp_ledger WHERE instance_id = '$quest';")
test "$rows" = "1:10" || { echo "quest ledger $rows"; exit 1; }
req1=$(psql -qAt -d "$db" -c "SELECT gen_random_uuid()")
req2=$(psql -qAt -d "$db" -c "SELECT gen_random_uuid()")
psql -v ON_ERROR_STOP=1 -qAt -d "$db" >"$tmp/c.log" 2>"$tmp/c.err" <<SQL &
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','$connor',true);
SELECT (public.companion_log_activity('$req1','Shared mile',null)->>'xpAwarded');
\! touch "$tmp/locked2"
SELECT pg_sleep(1);
COMMIT;
SQL
pid_c=$!
for i in $(seq 1 50); do
  if test -f "$tmp/locked2"; then break; fi
  if ! kill -0 "$pid_c" 2>/dev/null; then cat "$tmp/c.err"; exit 1; fi
  sleep 0.1
done
psql -v ON_ERROR_STOP=1 -qAt -d "$db" >"$tmp/d.log" 2>"$tmp/d.err" <<SQL &
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','$connor',true);
SELECT (public.companion_log_activity('$req2','Shared mile',null)->>'xpAwarded');
COMMIT;
SQL
pid_d=$!
wait "$pid_c" || { cat "$tmp/c.err"; exit 1; }
wait "$pid_d" || { cat "$tmp/d.err"; exit 1; }
awarded=$(cat "$tmp/c.log" "$tmp/d.log" | sort | tr '\n' ' ')
printf '%s\n' "$awarded" | grep -q '0'
printf '%s\n' "$awarded" | grep -q '10'
acts=$(psql -v ON_ERROR_STOP=1 -qAt -d "$db" -c "SELECT count(*) FROM public.xp_ledger WHERE owner_id = '$izzy' AND instance_id IN (SELECT instance_id FROM public.companion_activities WHERE title = 'Shared mile');")
test "$acts" = "1" || { echo "activity rows $acts"; cat "$tmp/c.log" "$tmp/d.log"; exit 1; }
echo "PASS companion concurrency: one quest award and one activity award"
