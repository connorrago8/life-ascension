-- TEST keeps pgcrypto in schema extensions, so public.digest does not exist.
-- Recreate the invite functions against extensions.digest. Do not move the extension.
-- Reverse with supabase/rollbacks/202611080003_companion_pgcrypto_digest_down.sql.

create schema if not exists extensions;

-- Local databases that installed pgcrypto in public still need a qualified name.
do $$
begin
  if to_regprocedure('extensions.digest(bytea,text)') is null
     and to_regprocedure('public.digest(bytea,text)') is not null then
    execute $fn$
      create function extensions.digest(p_data bytea, p_type text)
      returns bytea language sql immutable set search_path = public, pg_catalog
      as $body$ select public.digest(p_data, p_type) $body$
    $fn$;
    revoke all on function extensions.digest(bytea, text) from public, anon, authenticated;
  end if;
end $$;

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
    values (u, 'pending', encode(extensions.digest(pg_catalog.convert_to(lower(v_code), 'UTF8'), 'sha256'), 'hex'), v_expires)
    returning id into v_id;
  return jsonb_build_object('bondId', v_id, 'code', v_code, 'expiresAt', v_expires);
end $$;
revoke all on function public.companion_invite() from public, anon;
grant execute on function public.companion_invite() to authenticated;

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
  v_hash := encode(extensions.digest(pg_catalog.convert_to(lower(btrim(p_code)), 'UTF8'), 'sha256'), 'hex');
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
revoke all on function public.companion_accept(text) from public, anon;
grant execute on function public.companion_accept(text) to authenticated;
