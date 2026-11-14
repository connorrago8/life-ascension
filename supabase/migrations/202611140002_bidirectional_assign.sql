-- Either active bond member can assign a personal quest to the other.
-- The quest is owned by the assignee. Sending awards no XP.
-- Completion still uses the assignee's own quest receipt. The sender's ledgers are untouched.
-- A repeat for the same title, cadence, and period returns the existing row.

create or replace function public.companion_send_quest(
  p_title text, p_description text, p_due date, p_reward text, p_cadence text default 'daily')
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  u uuid := auth.uid();
  b public.companion_bonds%rowtype;
  v_to uuid;
  v_id uuid;
  v_title text := btrim(p_title);
  v_desc text := nullif(btrim(coalesce(p_description, '')), '');
  v_reward text := nullif(btrim(coalesce(p_reward, '')), '');
  v_cadence text := case when p_cadence = 'weekly' then 'weekly' else 'daily' end;
  v_today date;
  v_due date;
  v_period date;
  placed jsonb;
  v_existing boolean := false;
  before_inviter integer;
  before_companion integer;
  before_couple integer;
begin
  if u is null then raise exception 'Sign-in required'; end if;
  select * into b from public.companion_bonds
    where status = 'active' and u in (companion_id, inviter_id)
    for update;
  if not found or b.companion_id is null or b.inviter_id is null then
    raise exception 'Companion connection required';
  end if;
  if v_title is null or char_length(v_title) not between 1 and 120 then raise exception 'Invalid title'; end if;
  if v_desc is not null and char_length(v_desc) > 500 then raise exception 'Invalid description'; end if;
  if v_reward is not null and char_length(v_reward) > 200 then raise exception 'Invalid reward'; end if;
  v_to := case when u = b.companion_id then b.inviter_id else b.companion_id end;
  if v_to = u then raise exception 'Companion connection required'; end if;
  v_today := public.quest_game_day(pg_catalog.now(), public.quest_timezone(v_to));
  v_due := coalesce(p_due, v_today);
  v_period := case when v_cadence = 'weekly' then public.quest_week_start(v_due) else v_due end;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'assign:' || b.id::text || ':' || public.companion_title_key(v_title) || ':' || v_cadence || ':' || v_period::text, 0));
  select q.id into v_id
    from public.companion_quests q
    where q.bond_id = b.id
      and q.from_user = u
      and q.to_user = v_to
      and q.status <> 'declined'
      and public.companion_title_key(q.title) = public.companion_title_key(v_title)
      and (case when q.cadence = 'weekly' then 'weekly' else 'daily' end) = v_cadence
      and (case when v_cadence = 'weekly'
            then public.quest_week_start(coalesce(q.due_on, v_today))
            else coalesce(q.due_on, v_today) end) = v_period
    order by q.created_at desc
    limit 1;
  select count(*) into before_inviter from public.xp_ledger where owner_id = b.inviter_id;
  select count(*) into before_companion from public.xp_ledger where owner_id = b.companion_id;
  select count(*) into before_couple from public.companion_xp_ledger
    where owner_id in (b.inviter_id, b.companion_id);
  if v_id is null then
    insert into public.companion_quests(bond_id, from_user, to_user, title, description, due_on, reward_text, status, cadence)
      values (b.id, u, v_to, v_title, v_desc, v_due, v_reward, 'sent', v_cadence)
      returning id into v_id;
  else
    v_existing := true;
  end if;
  placed := public._place_companion_quest(v_id);
  if (select count(*) from public.xp_ledger where owner_id = b.inviter_id) <> before_inviter
    or (select count(*) from public.xp_ledger where owner_id = b.companion_id) <> before_companion
    or (select count(*) from public.companion_xp_ledger where owner_id in (b.inviter_id, b.companion_id)) <> before_couple then
    raise exception 'Sending a quest must not award XP';
  end if;
  return placed || jsonb_build_object(
    'questId', v_id,
    'cadence', v_cadence,
    'toUser', v_to,
    'idempotent', v_existing);
end $$;
revoke all on function public.companion_send_quest(text, text, date, text, text) from public, anon;
grant execute on function public.companion_send_quest(text, text, date, text, text) to authenticated;
