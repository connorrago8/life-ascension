#!/usr/bin/env bash
# Two sessions finish two different quests at the same moment on a user's first quest of the day.
# Exactly one may be "first of day" (no bonus); the other must get the streak bonus.
# Disposable test database only (run after every migration and tests/sql/prelude.sql).
set -euo pipefail
db="${DB:-life_ascension_auth_test}"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
user_id="00000000-0000-0000-0000-00000000f001"
# Ten days of history ending yesterday: F=10, so a non-first completion earns floor(1*2.0)=2.
psql -v ON_ERROR_STOP=1 -q -d "$db" <<SQL
INSERT INTO auth.users(id) VALUES ('$user_id');
DO \$\$
DECLARE d integer; q uuid; i uuid; day date := (now() AT TIME ZONE 'America/Chicago')::date;
BEGIN
  FOR d IN 1 .. 10 LOOP
    q := gen_random_uuid(); i := gen_random_uuid();
    INSERT INTO public.quests(id, owner_id, title, domain, cadence, scheduled_for, quest_type)
      VALUES (q, '$user_id', 'history', 'home', 'once', day - d, 'scheduled');
    INSERT INTO public.quest_instances(id, owner_id, quest_id, due_date, status, completed_at)
      VALUES (i, '$user_id', q, day - d, 'completed', ((day - d)::timestamp + interval '12 hours') AT TIME ZONE 'America/Chicago');
    INSERT INTO public.xp_ledger(owner_id, instance_id, amount, awarded_at)
      VALUES ('$user_id', i, 1, ((day - d)::timestamp + interval '12 hours') AT TIME ZONE 'America/Chicago');
  END LOOP;
END \$\$;
SQL
make_instance() {
  psql -v ON_ERROR_STOP=1 -qAt -d "$db" <<SQL | grep -E '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$' | tail -1
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','$user_id',false);
SELECT public.ensure_quest_instance(public.create_scheduled_quest('$1','home','daily',(now() AT TIME ZONE 'America/Chicago')::date,'scheduled'));
SQL
}
inst_a="$(make_instance 'Race A')"
inst_b="$(make_instance 'Race B')"
test -n "$inst_a" && test -n "$inst_b"
psql -v ON_ERROR_STOP=1 -qAt -d "$db" >"$tmp/a.log" 2>"$tmp/a.err" <<SQL &
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','$user_id',true);
SELECT (r->>'first_of_day') || ':' || (r->>'xp_awarded') FROM (SELECT public.set_quest_instance_status_v2('$inst_a'::uuid,'complete') r) x;
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
SELECT (r->>'first_of_day') || ':' || (r->>'xp_awarded') FROM (SELECT public.set_quest_instance_status_v2('$inst_b'::uuid,'complete') r) x;
COMMIT;
SQL
pid_b=$!
wait "$pid_a" || { cat "$tmp/a.err"; exit 1; }
wait "$pid_b" || { cat "$tmp/b.err"; exit 1; }
grep -qx 'true:1' "$tmp/a.log" || { echo "A:"; cat "$tmp/a.log"; exit 1; }
grep -qx 'false:2' "$tmp/b.log" || { echo "B:"; cat "$tmp/b.log"; exit 1; }
firsts="$(psql -v ON_ERROR_STOP=1 -qAt -d "$db" -c "SELECT count(*) FILTER (WHERE first_of_day) || ':' || sum(amount) FROM public.xp_ledger WHERE instance_id IN ('$inst_a','$inst_b');")"
test "$firsts" = "1:3" || { echo "Unexpected first-of-day count/sum: $firsts"; exit 1; }
echo "PASS concurrent first-of-day: one unboosted first, one boosted (+2 at F=10)"
