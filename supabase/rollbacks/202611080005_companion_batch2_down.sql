-- Reverse 202611080005. Restores the batch-1 companion screen and identity.
begin;

drop function if exists public.companion_register_proof(uuid, text, text, integer);
drop function if exists public.companion_delete_repeat(uuid);
drop function if exists public.companion_pause_repeat(uuid, boolean);
drop function if exists public.companion_save_repeat(text, text, integer, text);
drop function if exists public.companion_set_reward(text, integer);
drop function if exists public.companion_mark_notices_read();
drop function if exists public.companion_thank(uuid);
drop function if exists public.companion_nudge(uuid);
drop function if exists public.companion_dismiss_tip(text);
drop function if exists public.companion_set_identity(text, text, text);
drop function if exists public._companion_materialize(uuid);

create or replace function public.companion_set_identity(p_name text, p_title text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'Sign-in required'; end if;
  if not exists (
    select 1 from public.companion_bonds
    where status = 'active' and companion_id = u
  ) then raise exception 'Companion connection required'; end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 40 then raise exception 'Invalid name'; end if;
  if p_title not in ('Lantern Keeper','Hearth Warden','Pathfinder','Storyweaver','Dawn Herald') then
    raise exception 'Invalid title';
  end if;
  insert into public.companion_identities(user_id, display_name, title)
    values (u, btrim(p_name), p_title)
    on conflict (user_id) do update
      set display_name = excluded.display_name, title = excluded.title, updated_at = pg_catalog.now();
  return jsonb_build_object('saved', true, 'displayName', btrim(p_name), 'title', p_title);
end $$;

create or replace function public.companion_state()
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  u uuid := auth.uid();
  b public.companion_bonds%rowtype;
  partner uuid;
begin
  if u is null then raise exception 'Sign-in required'; end if;
  update public.companion_quests q
    set status = 'completed', completed_at = coalesce(q.completed_at, i.completed_at)
    from public.quest_instances i
    where q.instance_id = i.id and i.status = 'completed' and q.status = 'accepted'
      and u in (q.from_user, q.to_user);
  select * into b from public.companion_bonds
    where u in (inviter_id, companion_id)
    order by (status = 'active') desc, (status = 'pending') desc, created_at desc
    limit 1;
  if not found then
    return jsonb_build_object('userId', u, 'bond', null, 'quests', '[]'::jsonb, 'activities', '[]'::jsonb);
  end if;
  partner := case when b.inviter_id = u then b.companion_id else b.inviter_id end;
  return jsonb_build_object(
    'userId', u,
    'bond', jsonb_build_object(
      'id', b.id,
      'status', b.status,
      'role', case when b.inviter_id = u then 'inviter' else 'companion' end,
      'expiresAt', b.expires_at,
      'partnerId', partner,
      'partnerName', (select display_name from public.companion_identities where user_id = partner),
      'partnerTitle', (select title from public.companion_identities where user_id = partner)
    ),
    'identity', (
      select jsonb_build_object('displayName', display_name, 'title', title)
      from public.companion_identities where user_id = u
    ),
    'quests', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', q.id, 'title', q.title, 'description', q.description, 'dueOn', q.due_on,
        'rewardText', q.reward_text, 'status', q.status, 'fromUser', q.from_user, 'toUser', q.to_user,
        'instanceId', q.instance_id, 'createdAt', q.created_at
      ) order by q.created_at desc)
      from public.companion_quests q where q.bond_id = b.id
    ), '[]'::jsonb),
    'activities', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'title', a.title, 'note', a.note, 'recordedBy', a.recorded_by,
        'subjectId', a.subject_id, 'xp', l.amount, 'voided', a.voided_at is not null, 'createdAt', a.created_at
      ) order by a.created_at desc)
      from public.companion_activities a
      left join public.xp_ledger l on l.id = a.ledger_id
      where a.bond_id = b.id
    ), '[]'::jsonb)
  );
end $$;

drop table if exists public.companion_proofs;
drop table if exists public.companion_repeat_spawns;
drop table if exists public.companion_repeats;
drop table if exists public.companion_rewards;
drop table if exists public.companion_nudges;
drop table if exists public.companion_notices;
drop table if exists public.companion_tips;
alter table public.companion_identities drop constraint if exists companion_identities_avatar_path_check;
alter table public.companion_identities drop constraint if exists companion_identities_quest_color_check;
alter table public.companion_identities drop column if exists avatar_path;
alter table public.companion_identities drop column if exists quest_color;

do $bucket$
begin
  if to_regclass('storage.objects') is null then return; end if;
  execute 'drop policy if exists companion_proof_read on storage.objects';
  execute 'drop policy if exists companion_proof_insert on storage.objects';
  delete from storage.objects where bucket_id = 'companion-proof';
  delete from storage.buckets where id = 'companion-proof';
end
$bucket$;

commit;
