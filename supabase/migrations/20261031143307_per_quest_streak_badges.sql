-- Read-only daily streaks per quest. Does not change completion or XP awards.
-- SECURITY INVOKER keeps existing owner RLS authoritative.
create or replace function public.get_quest_streaks()
returns table (quest_id uuid, fire integer, done_today boolean, today date, time_zone text)
language sql stable security invoker set search_path = ''
as $$
  with clock as (
    select (pg_catalog.now() at time zone 'America/Chicago')::date as today
  ), daily as (
    select q.id from public.quests q
    where q.owner_id = auth.uid() and q.active and q.cadence = 'daily'
  ), days as (
    select distinct i.quest_id, (i.completed_at at time zone 'America/Chicago')::date as day
    from public.quest_instances i join daily q on q.id = i.quest_id cross join clock c
    where i.owner_id = auth.uid() and i.status = 'completed' and i.completed_at is not null
      and (i.completed_at at time zone 'America/Chicago')::date <= c.today
  ), ranked as (
    select d.quest_id, d.day, row_number() over (partition by d.quest_id order by d.day desc) as n,
      max(d.day) over (partition by d.quest_id) as latest
    from days d
  )
  select q.id,
    count(r.day) filter (where r.latest >= c.today - 1 and r.day = r.latest - (r.n - 1)::integer)::integer,
    coalesce(bool_or(r.day = c.today), false), c.today, 'America/Chicago'::text
  from daily q cross join clock c left join ranked r on r.quest_id = q.id
  group by q.id, c.today;
$$;
revoke all on function public.get_quest_streaks() from public, anon;
grant execute on function public.get_quest_streaks() to authenticated;
