create or replace function public.get_lifetime_xp()
returns bigint
language sql
stable
security invoker
set search_path = ''
as $$
 select coalesce(sum(amount),0)::bigint from public.xp_ledger where owner_id = (select auth.uid());
$$;
