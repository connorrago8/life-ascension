create or replace function public.get_lifetime_xp()
returns bigint
language sql
stable
security invoker
set search_path = ''
as $$
 select coalesce(sum(amount),0)::bigint from public.xp_ledger where owner_id = (select auth.uid());
$$;

revoke all on function public.get_lifetime_xp() from public,anon;
grant execute on function public.get_lifetime_xp() to authenticated;
