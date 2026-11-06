#!/usr/bin/env bash
# Isolated PostgreSQL only; deliberately overlapping real transactions, no hosted target.
set -euo pipefail
case "${PGHOST:-}" in localhost|127.0.0.1) ;; *) echo 'Local PostgreSQL required' >&2; exit 1;; esac
db=life_ascension_auth_test
log_a=$(mktemp); log_b=$(mktemp)
trap 'rm -f "$log_a" "$log_b"' EXIT
psql -v ON_ERROR_STOP=1 -d "$db" <<'SQL'
insert into auth.users(id) values('00000000-0000-0000-0000-00000000cc01'),('00000000-0000-0000-0000-00000000cc02');
create table public.companion_race_fixture(quest_id uuid,instance_id uuid);
grant select on public.companion_race_fixture to authenticated;
do $$ declare inv jsonb; pair uuid; offer uuid; inst uuid;
begin
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000cc01',false);
 inv:=public.companion_command('invite','{"role":"recipient"}');
 select id into pair from public.companion_pairs where inviter_id=auth.uid();
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000cc02',false);
 perform public.companion_command('join',jsonb_build_object('code',inv->>'inviteCode'));
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000cc01',false);
 perform public.companion_command('confirm',jsonb_build_object('pairId',pair));
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000cc02',false);
 offer:=(public.companion_command('send',jsonb_build_object('pairId',pair,'requestId',pg_catalog.gen_random_uuid(),'title','Concurrent real-life task'))->>'questId')::uuid;
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000cc01',false);
 perform public.companion_command('accept',jsonb_build_object('questId',offer));
 select instance_id into inst from public.companion_quests where id=offer;
 insert into public.companion_race_fixture values(offer,inst);
end $$;
SQL
PGAPPNAME=companion-race-first psql -v ON_ERROR_STOP=1 -d "$db" >"$log_a" 2>&1 <<'SQL' &
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000cc01',true);
select public.companion_command('complete',jsonb_build_object('questId',(select quest_id from public.companion_race_fixture)));
-- Hold the real pair/offer/instance locks after the first completion, for the second caller.
select pg_sleep(5);
commit;
SQL
pid_a=$!
held=false
for attempt in $(seq 1 100); do
 if [ "$(psql -At -d "$db" -c "select exists(select 1 from pg_stat_activity where application_name='companion-race-first' and wait_event='PgSleep')")" = t ]; then held=true; break; fi
 sleep .02
done
if [ "$held" != true ]; then cat "$log_a"; wait "$pid_a"; echo 'First completion never held its transaction' >&2; exit 1; fi
PGAPPNAME=companion-race-second psql -v ON_ERROR_STOP=1 -d "$db" >"$log_b" 2>&1 <<'SQL' &
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000cc01',true);
select public.companion_command('complete',jsonb_build_object('questId',(select quest_id from public.companion_race_fixture)));
commit;
SQL
pid_b=$!
blocked=false
for attempt in $(seq 1 100); do
 if [ "$(psql -At -d "$db" -c "select exists(select 1 from pg_stat_activity where application_name='companion-race-second' and wait_event_type='Lock')")" = t ]; then blocked=true; break; fi
 sleep .02
done
wait "$pid_a" || { cat "$log_a"; exit 1; }
wait "$pid_b" || { cat "$log_b"; exit 1; }
if [ "$blocked" != true ]; then cat "$log_a" "$log_b"; echo 'No actual lock overlap observed' >&2; exit 1; fi
psql -v ON_ERROR_STOP=1 -d "$db" <<'SQL'
do $$ declare inst uuid:=(select instance_id from public.companion_race_fixture);
begin
 if (select count(*) from public.xp_ledger where instance_id=inst)<>1 or (select amount from public.xp_ledger where instance_id=inst)<>2
  or (select count(*) from public.quest_events where instance_id=inst and event_type='completed')<>1 then raise exception 'Concurrent completion duplicated or lost credit'; end if;
end $$;
drop table public.companion_race_fixture;
select 'PASS actual overlapping companion completion: observed lock wait, one ledger row/2 XP, one event' as result;
SQL
