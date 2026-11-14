-- Restores companion-only assignment. Connor cannot send a personal quest to Izzy.

create or replace function public.companion_send_quest(
  p_title text, p_description text, p_due date, p_reward text, p_cadence text default 'daily')
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  u uuid := auth.uid();
  b public.companion_bonds%rowtype;
  v_id uuid;
  v_title text := btrim(p_title);
  v_desc text := nullif(btrim(coalesce(p_description, '')), '');
  v_reward text := nullif(btrim(coalesce(p_reward, '')), '');
  v_cadence text := case when p_cadence = 'weekly' then 'weekly' else 'daily' end;
  placed jsonb;
  before_count integer;
begin
  if u is null then raise exception 'Sign-in required'; end if;
  select * into b from public.companion_bonds where status = 'active' and companion_id = u for update;
  if not found then raise exception 'Companion connection required'; end if;
  if v_title is null or char_length(v_title) not between 1 and 120 then raise exception 'Invalid title'; end if;
  if v_desc is not null and char_length(v_desc) > 500 then raise exception 'Invalid description'; end if;
  if v_reward is not null and char_length(v_reward) > 200 then raise exception 'Invalid reward'; end if;
  select count(*) into before_count from public.xp_ledger where owner_id = b.inviter_id;
  insert into public.companion_quests(bond_id, from_user, to_user, title, description, due_on, reward_text, status, cadence)
    values (b.id, u, b.inviter_id, v_title, v_desc, p_due, v_reward, 'sent', v_cadence)
    returning id into v_id;
  placed := public._place_companion_quest(v_id);
  if (select count(*) from public.xp_ledger where owner_id = b.inviter_id) <> before_count then
    raise exception 'Sending a quest must not award XP';
  end if;
  return placed || jsonb_build_object('questId', v_id, 'cadence', v_cadence);
end $$;
revoke all on function public.companion_send_quest(text, text, date, text, text) from public, anon;
grant execute on function public.companion_send_quest(text, text, date, text, text) to authenticated;
