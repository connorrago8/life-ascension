-- Reverse 202611080003. Restores the previous public.digest invite functions.
begin;

create or replace function public.companion_invite()
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare u uuid := auth.uid(); v_code text; v_id uuid; v_expires timestamptz := pg_catalog.now() + interval '7 days';
begin
  if u is null then raise exception 'Sign-in required'; end if;
  if exists (select 1 from public.companion_bonds where status = 'active' and u in (inviter_id, companion_id)) then
    raise exception 'You already have a companion';
  end if;
  update public.companion_bonds
    set status = 'revoked', revoked_at = pg_catalog.now(), revoked_by = u
    where inviter_id = u and status = 'pending';
  v_code := substr(replace(pg_catalog.gen_random_uuid()::text, '-', ''), 1, 12);
  insert into public.companion_bonds(inviter_id, status, token_hash, expires_at)
    values (u, 'pending', encode(public.digest(pg_catalog.convert_to(lower(v_code), 'UTF8'), 'sha256'), 'hex'), v_expires)
    returning id into v_id;
  return jsonb_build_object('bondId', v_id, 'code', v_code, 'expiresAt', v_expires);
end $$;

create or replace function public.companion_accept(p_code text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  u uuid := auth.uid();
  v_hash text;
  b public.companion_bonds%rowtype;
begin
  if u is null then raise exception 'Sign-in required'; end if;
  if p_code is null or length(btrim(p_code)) < 8 then raise exception 'Invitation unavailable'; end if;
  v_hash := encode(public.digest(pg_catalog.convert_to(lower(btrim(p_code)), 'UTF8'), 'sha256'), 'hex');
  select * into b from public.companion_bonds where token_hash = v_hash for update;
  if not found then raise exception 'Invitation unavailable'; end if;
  if b.inviter_id = u then raise exception 'You cannot accept your own invitation'; end if;
  if b.status = 'revoked' then raise exception 'Invitation revoked'; end if;
  if b.status = 'active' and b.companion_id = u then
    return jsonb_build_object('accepted', true, 'already', true, 'bondId', b.id);
  end if;
  if b.status = 'active' then raise exception 'Invitation unavailable'; end if;
  if b.expires_at <= pg_catalog.now() then raise exception 'Invitation expired'; end if;
  if exists (select 1 from public.companion_bonds where status = 'active' and u in (inviter_id, companion_id)) then
    raise exception 'You already have a companion';
  end if;
  update public.companion_bonds
    set companion_id = u, status = 'active', accepted_at = pg_catalog.now()
    where id = b.id;
  return jsonb_build_object('accepted', true, 'already', false, 'bondId', b.id);
end $$;

commit;
