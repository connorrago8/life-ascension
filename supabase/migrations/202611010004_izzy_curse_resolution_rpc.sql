-- IZ-5: Restrict state changes to a trusted service-role database transaction.
-- This RPC does NOT reveal sealed curses. An independent, server-authoritative
-- missed-occurrence/provenance check is still required before a reveal RPC exists.
-- This transition function is intentionally limited to already-revealed curses.
create or replace function public.resolve_izzy_secret_curse(
  p_curse_id uuid,
  p_expected_state text,
  p_expected_seen_at timestamptz,
  p_action text
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_next_state text;
begin
  if p_action not in ('acknowledge', 'fulfill', 'forgive', 'decline')
    or p_expected_state <> 'revealed'
  then
    raise exception 'Invalid curse transition';
  end if;

  if p_action = 'acknowledge' then
    update public.izzy_secret_curses
       set seen_at = pg_catalog.now(), updated_at = pg_catalog.now()
     where id = p_curse_id
       and state = 'revealed'
       and revealed_at is not null
       and seen_at is not distinct from p_expected_seen_at
       and seen_at is null;
  else
    v_next_state := case p_action
      when 'fulfill' then 'fulfilled'
      when 'forgive' then 'forgiven'
      when 'decline' then 'declined'
    end;
    update public.izzy_secret_curses
       set state = v_next_state, updated_at = pg_catalog.now()
     where id = p_curse_id
       and state = 'revealed'
       and revealed_at is not null
       and seen_at is not distinct from p_expected_seen_at;
  end if;
  return found;
end;
$$;

revoke all on function public.resolve_izzy_secret_curse(uuid,text,timestamptz,text)
  from public, anon, authenticated;
grant execute on function public.resolve_izzy_secret_curse(uuid,text,timestamptz,text)
  to service_role;

comment on function public.resolve_izzy_secret_curse(uuid,text,timestamptz,text)
  is 'Service-role-only compare-and-swap for revealed curses. Backend must verify owner and consent before calling. Does not reveal sealed text or award XP.';
