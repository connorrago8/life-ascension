-- QA-only regression. Synthetic fixtures are rolled back; no XP is awarded.
begin;
do $$
declare
  u uuid := gen_random_uuid(); other_user uuid := gen_random_uuid();
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); missed uuid := gen_random_uuid(); hidden uuid := gen_random_uuid();
  t date := (now() at time zone 'America/Chicago')::date;
begin
  insert into auth.users(id) values (u), (other_user);
  insert into public.quests(id,owner_id,title,domain,cadence,scheduled_for,quest_type)
    values (a,u,'Brush teeth fixture','hygiene','daily',t-5,'scheduled'),
    (b,u,'Other daily fixture','home','daily',t-5,'scheduled'),
    (missed,u,'Missed yesterday fixture','home','daily',t-5,'scheduled'),
    (hidden,other_user,'Other account fixture','home','daily',t-5,'scheduled');
  insert into public.quest_instances(owner_id,quest_id,due_date,status,completed_at) values
    (u,a,t-2,'completed',((t-2)::timestamp + interval '12 hours') at time zone 'America/Chicago'),
    (u,a,t-1,'completed',((t-1)::timestamp + interval '23 hours 59 minutes') at time zone 'America/Chicago'),
    (u,a,t-3,'completed',((t-1)::timestamp + interval '12 hours') at time zone 'America/Chicago'),
    (u,b,t,'completed',(t::timestamp + interval '1 minute') at time zone 'America/Chicago'),
    (u,missed,t-2,'completed',((t-2)::timestamp + interval '12 hours') at time zone 'America/Chicago'),
    (other_user,hidden,t-1,'completed',((t-1)::timestamp + interval '12 hours') at time zone 'America/Chicago');
  perform set_config('request.jwt.claim.sub', u::text, true);
  execute 'set local role authenticated';
  assert (select fire from public.get_quest_streaks() where quest_id=a)=2, 'distinct completion days for this quest only';
  assert (select not done_today from public.get_quest_streaks() where quest_id=a), 'yesterday is not completed today';
  assert (select fire from public.get_quest_streaks() where quest_id=b)=1, 'another quest starts its own streak';
  assert (select fire from public.get_quest_streaks() where quest_id=missed)=0, 'another completed quest cannot bridge a missed day';
  assert not exists(select 1 from public.get_quest_streaks() where quest_id=hidden), 'another account is never returned';
  execute 'reset role';
  insert into public.quest_instances(owner_id,quest_id,due_date,status,completed_at)
    values (u,a,t,'completed',(t::timestamp + interval '1 minute') at time zone 'America/Chicago');
  execute 'set local role authenticated';
  assert (select fire from public.get_quest_streaks() where quest_id=a)=3, 'today extends only this quest';
  assert (select done_today from public.get_quest_streaks() where quest_id=a), 'today is kept';
  execute 'reset role';
  assert not exists(select 1 from public.xp_ledger where owner_id=u), 'read-only streaks do not award XP';
end $$;
rollback;
