#!/usr/bin/env bash
# Isolated PostgreSQL only; deliberately overlapping real transactions, no hosted target.
set -euo pipefail
case "${PGHOST:-}" in localhost|127.0.0.1) ;; *) echo 'Local PostgreSQL required' >&2; exit 1;; esac
db=life_ascension_auth_test
log_a=$(mktemp); log_b=$(mktemp)
trap 'rm -f "$log_a" "$log_b"' EXIT
psql -v ON_ERROR_STOP=1 -d "$db" <<'SQL'
insert into auth.users(id) values('00000000-0000-0000-0000-00000000bd01'),('00000000-0000-0000-0000-00000000bd02');
insert into public.companion_pairs(id,inviter_id,member_id,inviter_role,status)
 values('00000000-0000-0000-0000-00000000bd10','00000000-0000-0000-0000-00000000bd01','00000000-0000-0000-0000-00000000bd02','recipient','active');
SQL
PGAPPNAME=manual-race-first psql -v ON_ERROR_STOP=1 -d "$db" >"$log_a" 2>&1 <<'SQL' &
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000bd01',true);
select public.companion_activity('log','{"pairId":"00000000-0000-0000-0000-00000000bd10","requestId":"00000000-0000-0000-0000-00000000bd11","title":"Concurrent read","date":"2026-11-02"}');
-- Hold the actual manual write transaction while a distinct request for the same task arrives.
select pg_sleep(5);
commit;
SQL
pid_a=$!
held=false
for attempt in $(seq 1 100); do
 if [ "$(psql -At -d "$db" -c "select exists(select 1 from pg_stat_activity where application_name='manual-race-first' and wait_event='PgSleep')")" = t ]; then held=true; break; fi
 sleep .02
done
if [ "$held" != true ]; then cat "$log_a"; wait "$pid_a"; echo 'First manual save never held its transaction' >&2; exit 1; fi
PGAPPNAME=manual-race-second psql -v ON_ERROR_STOP=1 -d "$db" >"$log_b" 2>&1 <<'SQL' &
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000bd01',true);
select public.companion_activity('log','{"pairId":"00000000-0000-0000-0000-00000000bd10","requestId":"00000000-0000-0000-0000-00000000bd12","title":" concurrent   READ ","date":"2026-11-02"}');
commit;
SQL
pid_b=$!
blocked=false
for attempt in $(seq 1 100); do
 if [ "$(psql -At -d "$db" -c "select exists(select 1 from pg_stat_activity where application_name='manual-race-second' and wait_event_type='Lock')")" = t ]; then blocked=true; break; fi
 sleep .02
done
wait "$pid_a" || { cat "$log_a"; exit 1; }
if wait "$pid_b"; then cat "$log_b"; echo 'Duplicate manual task unexpectedly saved' >&2; exit 1; fi
if [[ "$(cat "$log_b")" != *'This activity is already logged for that day'* ]]; then cat "$log_b"; exit 1; fi
if [ "$blocked" != true ]; then cat "$log_a" "$log_b"; echo 'No actual lock overlap observed' >&2; exit 1; fi
psql -v ON_ERROR_STOP=1 -d "$db" <<'SQL'
do $$ begin
 if (select count(*) from companion_private.activity_entries where owner_id='00000000-0000-0000-0000-00000000bd01')<>1
 or exists(select 1 from public.xp_ledger where owner_id in ('00000000-0000-0000-0000-00000000bd01','00000000-0000-0000-0000-00000000bd02'))
 then raise exception 'Concurrent manual logs duplicated history or changed account XP'; end if;
end $$;
select 'PASS actual overlapping manual saves: observed lock wait, one record, duplicate rejected, no account XP' as result;
SQL
